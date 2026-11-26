# FormSaathi

AI-assisted government form guidance and autofill. The product has two user-facing parts: a web app for account and document management, and a browser extension for understanding supported forms and filling fields only after user approval.

## Current repository layout

- `web/`: React + Vite account workspace.
- `extension/`: Chrome Manifest V3 extension built with WXT and React. It signs in to the shared Supabase account and sends form field descriptors to the authenticated AI analysis API. Its document vault remains local to the browser.
- `server/`: authenticated Node.js API, Gemini-backed form analysis and image preparation service.
- `rapidocr_service/`: private-token-protected Python API running RapidOCR on CPU.
- `supabase/migrations/`: Postgres schema, Row Level Security policies and private Storage bucket setup.
- `demo/`: synthetic scholarship form for extension testing.
- `docs/`: architecture, privacy, development and extension-integration notes.

## Web app features

- Email/password sign-up and sign-in through Supabase Auth.
- Private document upload and category management (PDF, JPG, PNG and WebP; 10 MB per file).
- On-demand OCR using RapidOCR through the authenticated Node API.
- Candidate facts are saved as pending and must be individually reviewed before they enter the user's verified profile.
- Paper-form camera/gallery scan: OCR reads printed labels, Gemini vision locates writable areas, and exact reviewed profile values are overlaid onto a new downloadable image.
- Application progress tracker.
- Privacy centre with data deletion for documents, extracted candidates, verified profile facts and application records.

## Architecture

Supabase is the account and data layer: Auth identifies the user, Postgres stores user-owned metadata and reviewed facts, and a private Storage bucket holds original files. Row Level Security (RLS) scopes every user-owned table and the Storage bucket to the authenticated user.

The web app and extension use the same Supabase account. During a browser form scan, the extension sends only visible field descriptors (labels, names, placeholders, control types and dropdown choices) to the authenticated Node API. The web app also provides a mobile-friendly paper-form scanner with camera and gallery inputs. It does not send values already typed into the government form. The API validates the Supabase user, reads only that user's verified profile facts under Row Level Security, filters to facts plausibly relevant to the detected fields, and sends those facts plus field descriptors to Google Gemini only after explicit user consent. The model returns fact-key matches, not personal values; the backend validates each match and supplies the exact stored value. The extension presents suggestions for review and requires per-field approval before filling. For paper forms, the selected photo is processed in memory: RapidOCR reads labels, Gemini vision returns normalized coordinates for clearly empty writing areas, and Sharp overlays the exact verified values. The new JPEG is returned to the browser for review and download; the uploaded photo is not written to the FormSaathi document vault.

## Prerequisites

- Node.js 22.12+ or a current 24.x LTS release.
- pnpm 12.22.0.
- A Supabase project for the web app.
- A Gemini API key for AI form analysis (configured only on the Node API host).
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

Copy `server/.env.example` to `server/.env` and `web/.env.example` to `web/.env.local`. Set `GEMINI_API_KEY` only in the Node API environment. Never add it to the extension, web client, or Git.

Install the Python OCR dependencies once:

    python -m pip install -r rapidocr_service/requirements.txt

Start RapidOCR in one terminal:

    pnpm dev:rapidocr

Start the authenticated Node API in a second terminal:

    pnpm dev:server

The local values in `server/.env.example` point the Node API at `127.0.0.1:8788` and use a development-only shared token. Keep that token local; production uses a separate Render environment value.

Start the web app in a third terminal:

    pnpm dev:web

Open `http://localhost:5173`, create an account, upload a synthetic document and choose **Run OCR** from the document list. OCR requires the local service to be running. Review the candidates under Information profile before approving them.

To run the extension separately:

    pnpm dev:extension

Load `extension/.output/chrome-mv3-dev` from `chrome://extensions`. The extension still uses its local IndexedDB vault until account pairing is implemented.

## Commands

- `pnpm dev:web`: start the Vite web app.
- `pnpm build:web`: build the web app.
- `pnpm check:web`: type-check the web app.
- `pnpm dev:server`: run the authenticated Node API.
- `pnpm dev:rapidocr`: run the local Python RapidOCR API.
- `pnpm dev:extension`: run the Chrome extension dev build.
- `pnpm build:extension`: build the extension.
- `pnpm check:server`: check backend JavaScript syntax.
- `pnpm test`: run candidate extraction tests.

## Important prototype safety note

Use synthetic documents for demos until the Supabase project, RLS policies, access controls, backup retention, OCR service and deployment have been reviewed. Supabase Storage is configured as private, but this MVP is not end-to-end encrypted and has not had an independent security audit. Do not expose the current unauthenticated local OCR service to the public internet. Do not send Aadhaar, PAN, bank, income or other real personal data to the optional external AI route in this prototype.

The extension does not automatically submit government applications. CAPTCHA, payments, identity verification and final submission stay under the applicant's control.

## Current limitations

- AI form analysis requires `GEMINI_API_KEY` on the hosted Node API. Each request requires explicit consent. Only relevant verified profile facts and detected field descriptions are sent to Gemini; the backend returns original stored values only after validating model-selected fact keys.
- Paper-form image filling is AI-assisted, not guaranteed. Gemini's placement coordinates can be imperfect. The user must inspect every overlay and the original image remains unchanged. The route accepts JPG, PNG and WebP photos up to 10 MB.
- The hosted RapidOCR processor uses a free CPU service and may take longer on its first request or after inactivity.
- Candidate extraction still uses labelled-line heuristics; OCR text is not automatically treated as verified profile data.
- The default RapidOCR model is English-oriented. Hindi/Devanagari recognition requires configuring and evaluating the corresponding RapidOCR model before relying on it.
- Category retrieval does not yet distinguish every document subtype such as Class 10 versus Class 12 unless separately classified.
- Complex custom widgets, closed Shadow DOM, canvas-rendered forms and cross-origin frames may require manual assistance.
- File inputs must be attached manually.
- The web app currently supports email/password accounts, document metadata, candidate review and a basic application tracker. Password reset, account deletion, MFA and production audit logging remain future work.

## Lockfile note

The initial pnpm migration does not yet include a generated `pnpm-lock.yaml`. Run `pnpm install` once and commit the generated lockfile. Then switch CI to `pnpm install --frozen-lockfile`.

See `docs/ARCHITECTURE.md`, `docs/PRIVACY.md`, `docs/DEVELOPMENT.md` and `docs/EXTENSION_INTEGRATION.md`.
