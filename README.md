# FormSaathi

AI-assisted government form guidance and autofill. The product has two user-facing parts: a web app for account and document management, and a browser extension for understanding supported forms and filling fields only after user approval.

## Current repository layout

- `web/`: React + Vite account workspace.
- `extension/`: Chrome Manifest V3 extension built with WXT and React. Its current document vault is still local to the browser; account pairing is the next integration milestone.
- `server/`: local OCR, optional AI field mapping and image preparation service.
- `supabase/migrations/`: Postgres schema, Row Level Security policies and private Storage bucket setup.
- `demo/`: synthetic scholarship form for extension testing.
- `docs/`: architecture, privacy, development and extension-integration notes.

## Web app features

- Email/password sign-up and sign-in through Supabase Auth.
- Private document upload and category management (PDF, JPG, PNG and WebP; 10 MB per file).
- On-demand OCR using the existing local OCR service.
- Candidate facts are saved as pending and must be individually reviewed before they enter the user's verified profile.
- Application progress tracker.
- Privacy centre with data deletion for documents, extracted candidates, verified profile facts and application records.

## Architecture

Supabase is the account and data layer: Auth identifies the user, Postgres stores user-owned metadata and reviewed facts, and a private Storage bucket holds original files. Row Level Security (RLS) scopes every user-owned table and the Storage bucket to the authenticated user.

The current OCR service remains a local development service bound to `127.0.0.1:8787`. It is not a hosted or authenticated public API. The extension has not yet been paired with web accounts. See [the extension integration plan](docs/EXTENSION_INTEGRATION.md).

## Prerequisites

- Node.js 22.12+ or a current 24.x LTS release.
- pnpm 12.22.0.
- A Supabase project for the web app.
- Chrome or Chromium for extension development.

Install the pinned package manager if needed:

    npm install --global pnpm@12.22.0

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor and run `supabase/migrations/20261125000100_formsaathi_web_foundation.sql`.
3. In Project Settings → API Keys, copy the Project URL and the **publishable** key.
4. Copy `web/.env.example` to `web/.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. In Authentication → URL Configuration, set the local Site URL to `http://localhost:5173` and add `http://localhost:5173/**` and `http://127.0.0.1:5173/**` as redirect URLs.
6. Keep the service-role/secret key out of the web app and out of Git.

The migration creates user-owned tables with RLS and a **private** `formsaathi-documents` bucket. The web app uses only the publishable key; access is limited by the signed-in user's policies.

## Run locally

From the repository root:

    pnpm install

Copy `server/.env.example` to `server/.env` and `web/.env.example` to `web/.env.local`.

Start the local OCR service in one terminal:

    pnpm dev:server

Start the web app in another:

    pnpm dev:web

Open `http://localhost:5173`, create an account, upload a synthetic document and choose **Run OCR** from the document list. OCR requires the local service to be running. Review the candidates under Information profile before approving them.

To run the extension separately:

    pnpm dev:extension

Load `extension/.output/chrome-mv3-dev` from `chrome://extensions`. The extension still uses its local IndexedDB vault until account pairing is implemented.

## Commands

- `pnpm dev:web`: start the Vite web app.
- `pnpm build:web`: build the web app.
- `pnpm check:web`: type-check the web app.
- `pnpm dev:server`: run local OCR API.
- `pnpm dev:extension`: run the Chrome extension dev build.
- `pnpm build:extension`: build the extension.
- `pnpm check:server`: check backend JavaScript syntax.
- `pnpm test`: run candidate extraction tests.

## Important prototype safety note

Use synthetic documents for demos until the Supabase project, RLS policies, access controls, backup retention, OCR service and deployment have been reviewed. Supabase Storage is configured as private, but this MVP is not end-to-end encrypted and has not had an independent security audit. Do not expose the current unauthenticated local OCR service to the public internet. Do not send Aadhaar, PAN, bank, income or other real personal data to the optional external AI route in this prototype.

The extension does not automatically submit government applications. CAPTCHA, payments, identity verification and final submission stay under the applicant's control.

## Current limitations

- The extension is not yet connected to Supabase accounts or the web app. Pairing and extension access to verified profile facts are next.
- OCR runs only against the local development service; hosted, authenticated OCR is not implemented.
- OCR is English-first and candidate extraction uses labelled-line heuristics.
- Category retrieval does not yet distinguish every document subtype such as Class 10 versus Class 12 unless separately classified.
- Complex custom widgets, closed Shadow DOM, canvas-rendered forms and cross-origin frames may require manual assistance.
- File inputs must be attached manually.
- The web app currently supports email/password accounts, document metadata, candidate review and a basic application tracker. Password reset, account deletion, MFA and production audit logging remain future work.

## Lockfile note

The initial pnpm migration does not yet include a generated `pnpm-lock.yaml`. Run `pnpm install` once and commit the generated lockfile. Then switch CI to `pnpm install --frozen-lockfile`.

See `docs/ARCHITECTURE.md`, `docs/PRIVACY.md`, `docs/DEVELOPMENT.md` and `docs/EXTENSION_INTEGRATION.md`.
