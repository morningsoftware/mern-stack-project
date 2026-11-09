# Bug screenshots

Open an existing bug's detail drawer to upload or remove screenshots. Each bug
supports three images, each at most 2 MiB, stored as MongoDB Binary records in
bugScreenshots. There is no paid storage provider, public upload directory, or
external fetch. PNG, JPEG and WebP are accepted; SVG is rejected. The server checks
file signatures and declared media type, not a full image decode/re-encode.

Authenticated reporter or project team members can list, upload, fetch, and remove:

- GET /api/bug-reports/:bugId/screenshots: metadata only.
- POST /api/bug-reports/:bugId/screenshots: raw image bytes with Content-Type.
- GET /api/bug-reports/:bugId/screenshots/:id: private image bytes.
- DELETE /api/bug-reports/:bugId/screenshots/:id: remove, returns 204.

The client reads protected bytes using bearer authentication and revokes temporary
blob URLs after unmounting. Failed uploads preserve selected files. Uploading and
saving edits are separate actions. The three-image cap is allocated atomically
under concurrent upload requests. Deleting a bug removes its screenshot documents.
No screenshot bytes are included in bug list/detail JSON.

Set Nginx client_max_body_size to at least 3m before deploying; the application
still enforces its 2 MiB limit. Default Nginx upload limits may be smaller. Include
MongoDB screenshots in database backups and monitor storage growth. New indexes
are created at API startup. Deploy frontend and API together.
