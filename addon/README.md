# Drift Public Domain Addon

A real Stremio-compatible addon with both **catalog** and **stream** resources.

It is intentionally built around public-domain/openly available media rather than scraping unauthorized streaming sites.

## Run

From the Drift repo:

```bash
cd addon
npm start
```

Default:

```
http://127.0.0.1:7000/manifest.json
```

You can install that manifest in Drift or another Stremio-compatible client.

## What it implements

- `/manifest.json`
- `/catalog/movie/public-domain.json`
- `/meta/movie/ia:<identifier>.json`
- `/stream/movie/ia:<identifier>.json`

The catalog/search comes from Internet Archive's public metadata API. Stream URLs point directly to a selected video file from the Internet Archive item.

## Architecture

The important part is the same shape used by production Stremio addons:

```
Client
  |
  +-- manifest
  +-- catalog
  +-- meta
  +-- stream
           |
           +-- source adapter
                 |
                 +-- Internet Archive
```

That source-adapter boundary is deliberate. We can add more lawful sources later without rewriting the Stremio protocol layer.

## Next build targets

1. Add series support.
2. Add multiple quality variants when a source exposes them.
3. Add subtitles from source metadata.
4. Add configurable source adapters for media you own or are licensed to distribute.
5. Add caching and request timeouts.
6. Add automated protocol tests.
