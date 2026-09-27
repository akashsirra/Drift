# Drift Multi-Stream Addon

Drift now includes a Stremio-compatible movie addon at:

`/api/drift-addon/manifest.json`

### Local install

Start Drift:

```bash
npm run dev
```

Then use this addon manifest URL in Stremio:

```
http://127.0.0.1:3000/api/drift-addon/manifest.json
```

The addon exposes:

- movie catalog + search
- movie metadata
- multiple stream candidates per movie
- 4K/1080p examples
- a second movie to test the same resolver architecture

The demo catalog uses publicly available Blender/open-movie material and mirrors so the multi-source architecture can be tested without connecting to private or protected streaming providers.

Additional lawful sources can be added to the `MOVIES[].streams` arrays without changing the Stremio protocol surface.

Stremio's addon protocol defines catalog, metadata and stream resources over HTTP; stream responses can contain multiple stream objects, each with a URL.
