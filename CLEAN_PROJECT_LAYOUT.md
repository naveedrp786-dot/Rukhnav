# RUKHNAV clean source layout

- `backend/` — Node.js/Express API and the **canonical web UI** in `backend/public/`.
- `rukhnav-mobile/` — Expo / React Native mobile application.
- `deploy/` — deployment examples and server bootstrap templates.

Removed from this clean source package: duplicate top-level `Public/`, `node_modules`, `.git`, Expo cache, runtime uploads, logs, SQL/database backups, `.env` secrets, macOS metadata, patch/snapshot files, Postman exports, and obsolete prototype folders.

Before deployment, install dependencies from each package lock and create production environment variables from `backend/.env.production.example`. Runtime uploads must use persistent storage configured via `UPLOAD_ROOT`.
