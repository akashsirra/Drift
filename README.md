# Drift

**Your content. Your addons. Your way.**

Drift is an open, addon-powered streaming web app designed around compatibility with the Stremio addon protocol. It provides a unified interface for addon manifests, catalogs, metadata and stream resolution.

## Current status

The first working foundation includes:

- Next.js + TypeScript
- Dark, responsive streaming UI
- Install addons from `manifest.json` URLs
- Server-side addon manifest/resource proxy
- Stremio-compatible catalog and metadata/resource routing
- Catalog search when an addon advertises the `search` extra
- Metadata and stream resolution
- Local addon persistence in the browser

The addon protocol defines `catalog`, `meta`, `stream`, and `subtitles` resources and HTTP manifests; Drift follows those concepts for its compatibility layer. See the official protocol documentation: https://stremio.github.io/stremio-addon-sdk/protocol.html

## Roadmap

- [ ] Robust manifest validation
- [ ] Addon management/settings
- [ ] Library and watch history
- [ ] Unified global search
- [ ] Dedicated detail routes
- [ ] HTML5 media player and subtitle handling
- [ ] Stream capability detection
- [ ] PWA/offline shell
- [ ] Auth + synced preferences
- [ ] Safe download manager for content users are authorized to download
- [ ] Automated tests and deployment

## Legal/safety

Drift is an addon client. Users are responsible for the addons they install and the content they access. The project does not bundle copyrighted media or provide unauthorized sources.
