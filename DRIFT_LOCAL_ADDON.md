# Drift Local Addon

Drift Local is a built-in Stremio-compatible addon for media files you control on the phone.

## Media folder

By default it scans:

`$HOME/storage/movies`

Set a different folder before starting Drift:

`export DRIFT_MEDIA_ROOT="$HOME/storage/movies"`

Supported formats: MP4, WebM, M4V, MOV, MKV and OGG.

## Install in Drift

Use the Addons page and choose **Install Drift Local**. The manifest URL is:

`http://localhost:3000/api/drift-addon/manifest.json`

The addon provides:
- a searchable local movie catalog
- metadata generated from filenames
- direct HTTP range streams from the local media folder

This addon is intended for media files you own or are authorized to access.
