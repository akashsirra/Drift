# Drift

**Your content. Your addons. Your way.**

Drift is a private, localhost-first streaming web app built around compatibility with the Stremio addon protocol.

## What works

- Next.js + TypeScript
- Mobile-first dark streaming UI
- Install Stremio-compatible addon manifests, including `stremio://` links
- Catalog browsing with movie/series filtering and search when supported
- Metadata and stream resolution
- Series season/episode browsing with a TVMaze fallback for missing episode metadata
- HLS playback with hls.js
- Quality and audio-track selection
- Subtitle selection
- Playback resume and local watch history
- Auto-next episodes
- Local library
- Direct media downloads
- HLS → MP4 downloads through local FFmpeg
- Download progress tracking
- PWA install support and mobile bottom navigation
- Offline shell caching for the main app pages

## Local-first design

Drift is intentionally designed for one person running it on Android/Termux. The app can stay entirely on localhost, so there is no hosting requirement or server bill.

Typical workflow:

```bash
cd ~/api-watcher/job-tracker/Drift
npm install
npm run dev
```

Then open `http://localhost:3000`.

Keep Termux/Next.js running while you use Drift. Local FFmpeg is used for HLS-to-MP4 conversion.

## Addons

Drift consumes addon manifests and resources rather than bundling media sources. Users are responsible for the addons they install and the content they access.

Official Stremio addon SDK documentation:
https://stremio.github.io/stremio-addon-sdk/protocol.html

## Next polish targets

- Addon configuration UI for configurable manifests
- Enable/disable addons without deleting them
- Unified global search across installed addons
- Dedicated movie/series detail routes
- Better download job status and retry controls
- Proxy/addon SSRF and input hardening
- Automated tests
- Production build verification
