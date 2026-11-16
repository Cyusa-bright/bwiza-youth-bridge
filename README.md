# Bwiza Youth Bridge

Responsive React + Vite frontend and Express/MySQL API for Bwiza Youth Bridge.

## Run locally

Install frontend and backend dependencies from the project root:

```sh
npm install
npm --prefix server install
```

Configure the backend by copying `server/.env.example` to `server/.env` and filling in the MySQL, session, and (optionally) mail-provider settings. Then start each app in its own terminal from the project root.

Terminal 1 — frontend (Vite, port `5173`):

```sh
npm run dev:frontend
```

Terminal 2 — backend (Express, port `5000` by default):

```sh
npm run migrate
npm run dev:server
```

You can also run the backend from its own folder with `npm run dev`. The existing root `npm run dev` command remains an alias for the frontend.

Open the website at `http://localhost:5173`. The API listens on `http://localhost:5000`; its root returns API information, and its database readiness check is at `http://localhost:5000/api/v1/health` (also available through Vite at `http://localhost:5173/api/v1/health`). Health checks return `200` when the database responds and `503` when it is unavailable. The frontend Axios client calls `/api/v1`, which Vite proxies to `http://localhost:5000` by default. Override the proxy target with `VITE_API_PROXY_TARGET` if the API runs on a different host or port.

Create a production frontend build with `npm run build`, check the frontend with `npm run lint`, and run backend unit and HTTP integration tests with `npm --prefix server test`. The API integration tests use an in-memory session store and database stub; they do not require database credentials.

## Included

- Home, About, Programs and program details, Projects and project details, Events, Team, News and article details, Gallery, Get Involved, Contact, Privacy Policy, Terms, and 404 routes.
- Responsive navigation, reusable content cards, search and category filters, gallery lightbox, authenticated profile and applications views.
- Express authentication API with bcrypt password hashes, MySQL-backed HTTP-only sessions, CSRF protection, rate limits, password recovery, and role-protected admin endpoints.
- Contact message submissions, protected program/event applications, and role-protected content management for programs, projects, events, team members, website text, and image uploads.
- Admins can open `/admin` after signing in. Published program/project/team/event records are served from MySQL; the site retains its original local starter content when a collection has no published records.
- Editable local sample content in `src/data/content.js`.
- Axios API client in `src/services/api.js`; the session cookie is HTTP-only and is never read by frontend JavaScript.
- Resized WebP photography in `public/images`; the original JPEGs are retained in `media-originals/` and are not published with the frontend build.

## Database setup

Create a MySQL database named `byb` (or use another configured `DB_NAME`) with `utf8mb4`, and provide a least-privilege application account through `server/.env`:

```sql
CREATE DATABASE IF NOT EXISTS byb
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Apply additive migrations with `npm run migrate`. Migrations create missing tables and do not drop existing tables. The migration runner records applied files in `schema_migrations`; the MySQL session store keeps session records in its own table. Migration 003 adds editable-content fields and a separate `website_content` table; migration 004 adds indexes for published-content reads.

Uploaded images are limited to valid JPEG, PNG, or WebP files up to 5 MB. They are decoded and re-encoded to remove metadata, assigned generated filenames, and stored under `server/uploads`; mount this directory on persistent storage and include it in your backup plan. The API serves uploads at `/api/v1/uploads/…`. Original site photography is kept under `media-originals/`; `npm --prefix server run optimize-images` regenerates only WebP photos referenced by the site and the gallery's responsive 480/960px variants, leaving the full original archive intact. The public gallery is code-curated (8 photos initially, up to 12); the current admin/API does not provide gallery-specific selection or caption metadata, so confirm photo permissions before publishing and update the curated list in `src/data/content.js` when approved images change.

All configuration is read from environment variables. Do not commit `server/.env`. Password reset email requires `MAIL_HOST` and `MAIL_FROM`; recovery returns a clear unavailable response until mail is configured. Register the administrator account using the desired email and password, then grant it the admin role:

```sh
npm run promote-admin -- admin@example.org
```

See [server/README.md](./server/README.md) for endpoint payloads, response shapes, statuses, and security behavior.

## Production deployment

1. Provision MySQL/MariaDB with a dedicated application user, a strong password, least-privilege access, and TLS enabled.
2. Set `NODE_ENV=production`, `DB_PASSWORD`, `DB_SSL=true`, `SESSION_SECRET`, `FRONTEND_ORIGIN`, and `FRONTEND_BASE_URL` in the backend's secret manager. Production startup rejects missing database passwords, disabled DB TLS, HTTP origins, and the example session secret. Generate a session secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
3. Use HTTPS at the reverse proxy or hosting platform. The API expects one trusted reverse-proxy hop; keep the API bound behind that proxy, and configure HTTPS/HSTS for the frontend host as well. Keep the frontend and API on the same site (for example `www.example.org` and `api.example.org`) so the `SameSite=Lax` session cookie can be sent. `FRONTEND_ORIGIN` must exactly match the browser-visible frontend origin.
4. Install locked dependencies with `npm ci` and `npm --prefix server ci`. Back up the database, run `npm run migrate` once, then start the API with `npm --prefix server start`.
5. Build with `npm run build` and publish `dist/` as static frontend content. Configure the static host to serve `index.html` for client-side routes. If the API is on another origin, set `VITE_API_BASE_URL` to its `/api/v1` URL at build time. Never put database credentials, mail credentials, or session secrets in `VITE_*` variables.
6. Persist `server/uploads/` outside the deploy bundle and restrict direct access to the API host. Verify `/api/v1/health`, a browser login, an admin content update, and an uploaded image after deployment.

The local `server/.env` is currently a development configuration and is not production deployment evidence. Configure production secrets and verify the host, TLS, backups, SMTP delivery, and persistent upload storage before launch. Newsletter delivery is not integrated; the website now clearly directs visitors to the contact form rather than pretending to subscribe them.

## Database backup and recovery

Back up the database and uploaded images together on a schedule appropriate for the organization's recovery requirements. Protect backups as sensitive data: they contain personal information, password hashes, session records, and password-reset metadata. Keep encrypted off-host copies and periodically test a restore in a non-production environment.

With MySQL client tools installed and access to the database host, `-p` prompts for the database password instead of putting it in the command:

```sh
mysqldump --single-transaction --quick --triggers -h DB_HOST -u DB_USER -p DB_NAME > byb-backup.sql
```

Separately snapshot `server/uploads/`. To recover, stop the API, restore the SQL dump into the intended database with `mysql -h DB_HOST -u DB_USER -p DB_NAME < byb-backup.sql`, restore the matching upload snapshot to persistent storage, then start the API and verify the health check and representative published images. Never test a restore against the only production database.

## Before publishing

Replace clearly marked sample copy, team profiles, impact figures, partner marks, contact details, social links, and any photography that is not approved for publication. Confirm appropriate consent and image permissions before publishing photos of participants. Complete and review the privacy policy and terms. Configure production HTTPS, a strong session secret, database backups, and a mail provider before deployment. Do not advertise newsletter subscriptions until a real consent-based provider and storage/retention policy are configured.
