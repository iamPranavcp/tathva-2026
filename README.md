# Tathva 2026 event site

A mobile-first event showcase with an authenticated CMS at `/admin`. The app is a Node.js web service: it serves the public site and private CMS, and validates CMS sessions on the backend.

## Local development

```sh
npm start
```

Open `http://localhost:3000`. Local mode stores edits in `data/site.json` and uploaded files in `data/uploads`. The local-only default CMS password is `change-this-before-deploying`.

## Free cloud deployment: Render + Supabase

The included Render Blueprint runs the site and API on Render's free web service. Supabase provides the persistent Postgres content record and public media bucket. This is necessary because Render free services have an ephemeral filesystem; uploaded files and local JSON changes disappear when a service restarts, redeploys, or spins down.

This free setup is suitable for a prototype or low-traffic event site, with limits: Render sleeps after 15 minutes without traffic and can take about a minute to wake; Supabase Free has a 500 MB database quota, 1 GB Storage, 5 GB egress and can pause low-activity projects after 7 days. This is not a production-grade uptime or backup tier: free Render services sleep, and Supabase Free does not provide downloadable database backups. Keep a local copy of `data/site.json` and `data/uploads`; export the hosted content and storage media regularly if the CMS is used live.

### 1. Create Supabase storage and database

1. Create a Supabase project. Choose **Singapore** to keep the database close to the Render service; Supabase also offers Mumbai if regional data location is preferred.
2. In **Storage**, create a bucket named `tathva-media` and mark it **Public**. The CMS still requires its separate password; the published images and videos need public read access to display on the website.
3. Open **SQL Editor**, run the contents of [scripts/supabase-schema.sql](scripts/supabase-schema.sql). This creates the single-row content table with row-level security enabled and no public policies.
4. In **Project Settings → API Keys**, copy the project URL and a **secret key** (starts with `sb_secret_`). Keep the secret private; it belongs only in the server's environment variables.

### 2. Migrate the current CMS content and uploaded media

Before first deploy, run the migration script from this project directory. It copies the current `data/site.json` content and any local `/media/...` uploads to Supabase Storage, then publishes the updated record to Supabase:

PowerShell:

```powershell
$env:SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co"
$env:SUPABASE_SECRET_KEY = "sb_secret_..."
$env:SUPABASE_BUCKET = "tathva-media"
node scripts/seed-supabase.js
```

The script uses the current local data and `data/uploads`, including media ignored by Git. Run it from the machine that has the current CMS content and uploads. It can be run again to publish the current local data. Keep your project secret key out of source control and chat.

### 3. Deploy the web app

1. Push this project to a private GitHub repository.
2. In Render, select **New → Blueprint**, connect that repository, and apply `render.yaml`.
3. In the Render service environment, set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_BUCKET=tathva-media`. Set `CMS_PASSWORD` to a strong private password when the Blueprint prompts for the unsynced secret. Keep `NODE_ENV=production`.
4. Wait for the deploy to finish, then open the Render `.onrender.com` URL. Confirm the homepage and `/api/site` load, then sign in at `/admin` and publish a harmless CMS edit to verify persistence.
5. To connect a custom domain later, add it in Render's service settings and follow its DNS instructions.

The public API only returns site content. All write and upload endpoints require the CMS session. Supabase's secret key remains on the Render backend and is never sent to the browser.

## CMS and media

The CMS can edit all carousel slides and durations, upload featured images/video, toggle hero overlays, edit the ticker, and maintain venue/event cards. `POST /api/upload` accepts JPG, PNG, WebP, or MP4 files up to 8 MB. In cloud mode uploads go directly from the server to the Supabase bucket; in local mode they stay under `data/uploads`.

The CMS route is `/admin`, is marked `noindex`, and does not have a public navigation link. It is password-protected; keep the Render `CMS_PASSWORD` secret private.

## Other hosting

For a different host, run Node.js 22+ with `npm start`, set `CMS_PASSWORD`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY`, and set `SUPABASE_BUCKET` if you use a different public bucket name. Without Supabase variables, the server falls back to local JSON/filesystem storage, which requires a durable disk and a single app instance.

