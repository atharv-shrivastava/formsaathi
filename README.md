# FormSaathi

AI-assisted, privacy-first government form guidance and autofill prototype.

FormSaathi helps a citizen organize documents, inspect a web form, retrieve only the document categories relevant to that form, extract evidence-backed facts locally, review proposed mappings, and fill individual fields only after explicit approval. It never automatically submits a government application.

## Current prototype

- Chrome Manifest V3 extension built with WXT + React.
- On-demand DOM inspection of visible form controls.
- Shadow-DOM visual overlay for highlighting the selected field.
- Local document registry in IndexedDB. Files are not uploaded when they are added to the vault.
- Requirement-driven retrieval: only matching document categories are sent to the local OCR service when the user scans a form.
- Local OCR API using Tesseract.js and Sharp, bound to 127.0.0.1.
- Evidence-linked candidate facts and deterministic field mapping.
- Optional Gemini mapping endpoint. It is disabled unless configured and requires explicit consent.
- Human review before each field is filled. No auto-submit, CAPTCHA solving or portal-security bypass.

## Repository layout

- `extension/`: Chrome extension and UI.
- `server/`: local OCR / optional AI API.
- `docs/`: architecture, privacy and development notes.

## Prerequisites

- Node.js 20.19+ or 22.12+ (use a current LTS release).
- npm 10+.
- Google Chrome or Chromium.
- Optional: Gemini API key for the opt-in mapping experiment.

## Run locally

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Create the local API environment file:

   ```bash
   cp server/.env.example server/.env
   ```

3. Start the local OCR service:

   ```bash
   npm run dev:server
   ```

   The service binds to `127.0.0.1:8787`. It does not save uploaded files. OCR requests process one selected document in memory and return extracted text. The first Tesseract run may download language data.

4. In a second terminal, start the extension dev build:

   ```bash
   npm run dev:extension
   ```

   Follow WXT's output and load the generated `extension/.output/chrome-mv3-dev` directory at `chrome://extensions` using **Load unpacked**.

5. Open a local test form or a portal you are authorized to use. Click the FormSaathi extension icon, scan the page, choose a suggested value, review it, and approve each individual fill action.

## Important prototype safety note

Use synthetic documents only until a production-grade security review is complete. This prototype stores selected files in browser IndexedDB, which is not an encrypted document vault. The local OCR API is loopback-only but is a development service, not an internet-facing production API. The optional Gemini adapter sends only the selected extracted text/facts and field descriptors after the user explicitly opts in. Do not send Aadhaar, PAN, bank, income or other real personal data to an external model in this prototype.

The extension uses broad page matching for the prototype, but does not inspect a page until the user clicks **Scan current page**. Before release, restrict supported origins, minimize permissions, add a hardened local API pairing/authentication flow, encrypt stored files and facts, and conduct security and privacy testing.

## Current limitations

- OCR is English-first by default; regional-language packs and validation need to be added and evaluated.
- Candidate extraction uses conservative heuristics, not a verified government-document model.
- Complex custom widgets, closed Shadow DOM, canvas-rendered forms and cross-origin frames may require manual assistance.
- File inputs cannot be populated by arbitrary JavaScript. FormSaathi guides the user to attach files manually.
- CAPTCHA, payment, final submission and other sensitive actions remain user-controlled.
- No eligibility decision is authoritative. Users must check scheme rules and official instructions.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/PRIVACY.md](docs/PRIVACY.md) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
