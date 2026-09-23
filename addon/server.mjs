import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 7000);
const HOST = process.env.HOST || "127.0.0.1";
const BASE = process.env.PUBLIC_URL || `http://${HOST}:${PORT}`;

const json = (res, body, status = 200) => {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store"
  });
  res.end(data);
};

const text = (res, body, status = 200) => {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "access-control-allow-origin": "*"
  });
  res.end(body);
};

const clean = (value = "") => String(value).replace(/[<>]/g, "").trim();

function manifest() {
  return {
    id: "org.drift.publicdomain",
    version: "0.1.0",
    name: "Drift Public Domain",
    description: "Catalog + streams for public-domain and openly licensed movies.",
    logo: "",
    types: ["movie"],
    idPrefixes: ["ia:"],
    catalogs: [{
      type: "movie",
      id: "public-domain",
      name: "Public Domain Movies",
      extra: [{ name: "search", isRequired: false }]
    }],
    resources: ["catalog", "meta", "stream"]
  };
}

async function iaSearch(search = "") {
  const q = search
    ? `mediatype:movies AND title:(${search.replace(/[":]/g, " ")})`
    : "mediatype:movies";
  const url = new URL("https://archive.org/advancedsearch.php");
  url.searchParams.set("q", q);
  url.searchParams.append("fl[]", "identifier");
  url.searchParams.append("fl[]", "title");
  url.searchParams.append("fl[]", "description");
  url.searchParams.append("fl[]", "year");
  url.searchParams.set("rows", "24");
  url.searchParams.set("page", "1");
  url.searchParams.set("output", "json");
  const r = await fetch(url, { headers: { "user-agent": "DriftAddon/0.1" } });
  if (!r.ok) throw new Error(`Internet Archive search failed: ${r.status}`);
  const data = await r.json();
  return data?.response?.docs || [];
}

async function iaMeta(identifier) {
  const r = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, {
    headers: { "user-agent": "DriftAddon/0.1" }
  });
  if (!r.ok) throw new Error(`Internet Archive metadata failed: ${r.status}`);
  return r.json();
}

function metaPreview(item) {
  const id = `ia:${item.identifier}`;
  return {
    id,
    type: "movie",
    name: item.title || item.identifier,
    poster: `https://archive.org/services/img/${encodeURIComponent(item.identifier)}`,
    description: clean(item.description || ""),
    releaseInfo: item.year ? String(item.year) : "Public Domain"
  };
}

function pickVideoFile(files = []) {
  const candidates = files.filter(f => {
    const name = String(f.name || "").toLowerCase();
    const format = String(f.format || "").toLowerCase();
    return (
      /\\.(mp4|webm|m4v)$/.test(name) ||
      /mpeg-4|h\.264|webm|matroska/.test(format)
    );
  });
  candidates.sort((a, b) => {
    const score = f => {
      const name = String(f.name || "").toLowerCase();
      const format = String(f.format || "").toLowerCase();
      let s = 0;
      if (/\\.mp4$/.test(name)) s += 40;
      if (/h\.264|mpeg-4/.test(format)) s += 30;
      if (/1080|720/.test(name)) s += 10;
      if (/thumb|sample|trailer|preview/.test(name)) s -= 50;
      return s;
    };
    return score(b) - score(a);
  });
  return candidates[0] || null;
}

async function streamFor(identifier) {
  const data = await iaMeta(identifier);
  const file = pickVideoFile(data?.files);
  if (!file) return { streams: [] };

  const url = new URL(`https://archive.org/download/${encodeURIComponent(identifier)}/${file.name.split("/").map(encodeURIComponent).join("/")}`);
  const label = file.name?.match(/(2160|1440|1080|720|480)p/i)?.[1] || "Source";
  return {
    streams: [{
      name: `Drift Public Domain · ${label}`,
      title: file.name,
      url: url.toString(),
      behaviorHints: {
        bingeGroup: `ia:${identifier}`
      }
    }]
  };
}

async function handle(req, res) {
  const u = new URL(req.url || "/", BASE);
  const path = u.pathname;

  if (req.method !== "GET") return text(res, "Method Not Allowed", 405);

  if (path === "/manifest.json") return json(res, manifest());

  const catalogMatch = path.match(/^\/catalog\/movie\/public-domain\.json$/);
  if (catalogMatch) {
    try {
      const metas = (await iaSearch(clean(u.searchParams.get("search") || ""))).map(metaPreview);
      return json(res, { metas });
    } catch (error) {
      return json(res, { metas: [], error: String(error?.message || error) }, 502);
    }
  }

  const metaMatch = path.match(/^\/meta\/movie\/(ia%3A|ia:)?([^/]+)\.json$/);
  if (metaMatch) {
    const identifier = decodeURIComponent(metaMatch[2]);
    try {
      const items = await iaSearch(identifier);
      const found = items.find(x => x.identifier === identifier);
      if (!found) return json(res, { meta: null }, 404);
      return json(res, {
        meta: {
          ...metaPreview(found),
          background: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
          videos: [{
            id: `ia:${identifier}`,
            title: found.title || identifier,
            released: found.year ? `${found.year}-01-01T00:00:00.000Z` : undefined
          }]
        }
      });
    } catch (error) {
      return json(res, { meta: null, error: String(error?.message || error) }, 502);
    }
  }

  const streamMatch = path.match(/^\/stream\/movie\/(ia%3A|ia:)?([^/]+)\.json$/);
  if (streamMatch) {
    const identifier = decodeURIComponent(streamMatch[2]);
    try {
      return json(res, await streamFor(identifier));
    } catch (error) {
      return json(res, { streams: [], error: String(error?.message || error) }, 502);
    }
  }

  return text(res, "Not Found", 404);
}

http.createServer(handle).listen(PORT, HOST, () => {
  console.log(`Drift addon running at ${BASE}`);
  console.log(`Manifest: ${BASE}/manifest.json`);
});
