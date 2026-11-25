# Development guide

## Prerequisites

- Node.js 22.12+ or a current 24.x LTS release.
- pnpm 12.22.0.
- A Supabase project for the web workspace.
- Google Chrome or Chromium for extension work.

Install the pinned package manager if needed:

    npm install --global pnpm@12.22.0

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/migrations/20261125000100_formsaathi_web_foundation.sql` in the SQL Editor.
3. Copy `web/.env.example` to `web/.env.local` and add the Project URL and publishable key.
4. Add `http://localhost:5173/**` and `http://127.0.0.1:5173/**` to Auth redirect URLs.
5. Never use the Supabase service-role/secret key in the browser.

## Start the web application

From the repository root:

    pnpm install

Then start:

    pnpm dev:web

Open `http://localhost:5173`. Sign up with an email address, confirm the email if Supabase email confirmation is enabled, and sign in. Upload a synthetic PDF/image and choose a category.

## Start local OCR

In another terminal, copy `server/.env.example` to `server/.env` and run:

    pnpm dev:server

The service listens on `127.0.0.1:8787`. The web app downloads the user's selected private document in the browser and sends it to this local service only after the user clicks Run OCR. Candidate facts are stored as pending rows. Approve a candidate on the Information profile page before it becomes a verified profile fact.

The OCR service is for local development only. It is not authenticated and must not be exposed to the public internet.

## Start the extension

    pnpm dev:extension

Load `extension/.output/chrome-mv3-dev` at `chrome://extensions`. The current extension still uses its own IndexedDB vault. The web-to-extension account pairing flow is a separate next milestone; do not treat a web login as connected to the extension yet.

## Run the mock scholarship form

Start a static server from the repository root:

    py -m http.server 4173 --directory demo

Open `http://127.0.0.1:4173/scholarship-form.html`. Use synthetic documents and fake details only.

## Commands

- `pnpm dev:web`: run the web app.
- `pnpm check:web`: type-check the web app.
- `pnpm build:web`: build the web app.
- `pnpm dev:server`: run local OCR API.
- `pnpm dev:extension`: run the Chrome extension dev build.
- `pnpm build:extension`: build the extension.
- `pnpm check:server`: check local server JavaScript syntax.
- `pnpm test`: run candidate extraction tests.

## Development checklist

- [ ] Generate and commit `pnpm-lock.yaml`, then switch CI to frozen-lockfile.
- [ ] Verify Supabase Auth, RLS policies and private Storage against two different test accounts.
- [ ] Add OCR integration tests and more document layouts.
- [ ] Implement secure web-to-extension pairing and token revocation.
- [ ] Build an authenticated hosted OCR API before cloud deployment.
- [ ] Add password reset, MFA and account deletion.
- [ ] Add extension tests for dynamic forms, frames and scroll/zoom behavior.
- [ ] Restrict extension matches to supported domains for release.
- [ ] Add document-language selection and OCR quality evaluation.
- [ ] Complete a security and privacy review before real personal data is used.
