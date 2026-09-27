import { NextRequest, NextResponse } from "next/server";

type Stream = {
  name: string;
  title?: string;
  url: string;
  behaviorHints?: Record<string, unknown>;
};

type Movie = {
  id: string;
  type: "movie";
  name: string;
  year: number;
  description: string;
  poster?: string;
  background?: string;
  streams: Stream[];
};

const MOVIES: Movie[] = [
  {
    id: "tt1254207",
    type: "movie",
    name: "Big Buck Bunny",
    year: 2008,
    description:
      "Big Buck Bunny is a Blender Foundation open movie. This Drift addon uses authorized/publicly available copies for testing the multi-source playback pipeline.",
    poster:
      "https://image.tmdb.org/t/p/w600_and_h900_bestv2/uVEFQvFMMsg4e6yb03xOfVsDz4o.jpg",
    streams: [
      {
        name: "Drift • 4K",
        title: "4K · Princeton mirror",
        url: "https://mirror.math.princeton.edu/pub/xbmc/demo-files/BBB/bbb_sunflower_2160p_30fps_normal.mp4",
      },
      {
        name: "Drift • 1080p",
        title: "1080p · Blender distribution",
        url: "https://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_normal.mp4",
      },
      {
        name: "Drift • 1080p Mirror",
        title: "1080p · Princeton mirror",
        url: "https://mirror.math.princeton.edu/pub/xbmc/demo-files/BBB/bbb_sunflower_1080p_30fps_normal.mp4",
      },
      {
        name: "Drift • 4K Backup",
        title: "4K · Backup mirror",
        url: "https://builds.stage.hive.pt/videos/bbb_sunflower_2160p_30fps_normal.mp4",
      },
    ],
  },
  {
    id: "tt1727587",
    type: "movie",
    name: "Sintel",
    year: 2010,
    description:
      "Sintel is a Blender Foundation open movie. The demo source is included to exercise a second movie and the same multi-provider resolver.",
    streams: [
      {
        name: "Drift • 1080p",
        title: "1080p · Public mirror",
        url: "https://builds.stage.hive.pt/videos/Sintel.2010.1080p.mp4",
      },
      {
        name: "Drift • 1080p MKV",
        title: "1080p · Blender MKV",
        url: "https://download.blender.org/demo/movies/Sintel.2010.1080p.mkv",
      },
    ],
  },
];

const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "*",
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

function json(data: unknown, status = 200) {
  return new NextResponse(JSON.stringify(data), { status, headers });
}

function normalizePath(parts: string[]) {
  return parts.map((x) => decodeURIComponent(x)).filter(Boolean);
}

function catalog(search = "") {
  const q = search.trim().toLowerCase();
  const movies = q
    ? MOVIES.filter((m) => m.name.toLowerCase().includes(q))
    : MOVIES;

  return {
    metas: movies.map((m) => ({
      id: m.id,
      type: m.type,
      name: m.name,
      year: m.year,
      poster: m.poster,
    })),
  };
}

function meta(id: string) {
  const movie = MOVIES.find((m) => m.id === id);
  if (!movie) return null;

  return {
    meta: {
      id: movie.id,
      type: movie.type,
      name: movie.name,
      year: movie.year,
      description: movie.description,
      poster: movie.poster,
      background: movie.background,
      videos: [
        {
          id: movie.id,
          title: movie.name,
          released: new Date(movie.year, 0, 1).toISOString(),
        },
      ],
    },
  };
}

function streams(id: string) {
  const movie = MOVIES.find((m) => m.id === id);
  if (!movie) return null;

  return {
    streams: movie.streams.map((stream) => ({
      ...stream,
      behaviorHints: {
        notWebReady: false,
        bingeGroup: \`drift-\${movie.id}\`,
        ...(stream.behaviorHints || {}),
      },
    })),
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  const parts = normalizePath(path);

  if (parts.length === 1 && parts[0] === "manifest.json") {
    return json({
      id: "com.akash.drift.multistream",
      version: "1.0.0",
      name: "Drift Multi-Stream",
      description:
        "Local-first Stremio addon with movie catalogs and multiple authorized/public demo streams per title.",
      logo: "https://www.stremio.com/website/stremio-logo-small.png",
      resources: [
        "catalog",
        { name: "meta", types: ["movie"], idPrefixes: ["tt"] },
        { name: "stream", types: ["movie"], idPrefixes: ["tt"] },
      ],
      types: ["movie"],
      idPrefixes: ["tt"],
      catalogs: [
        {
          type: "movie",
          id: "driftmovies",
          name: "Drift Movies",
          extra: [{ name: "search", isRequired: false }],
        },
      ],
      behaviorHints: {
        configurable: false,
        adult: false,
      },
    });
  }

  if (parts[0] === "catalog" && parts[1] === "movie" && parts[2]?.startsWith("driftmovies")) {
    return json(catalog(req.nextUrl.searchParams.get("search") || ""));
  }

  if (parts[0] === "meta" && parts[1] === "movie" && parts[2]) {
    const result = meta(parts[2].replace(/\.json$/i, ""));
    return result ? json(result) : json({ meta: null }, 404);
  }

  if (parts[0] === "stream" && parts[1] === "movie" && parts[2]) {
    const result = streams(parts[2].replace(/\.json$/i, ""));
    return result ? json(result) : json({ streams: [] }, 404);
  }

  return json({ error: "Not found" }, 404);
}
