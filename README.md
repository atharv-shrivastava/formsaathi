# FormSaathi

AI-assisted, privacy-first government form guidance and autofill prototype.

FormSaathi helps a citizen organize documents, inspect a web form, retrieve only the document categories relevant to that form, extract evidence-backed facts locally, review proposed mappings, and fill fields only after explicit approval. It never automatically submits a government application.

## Current prototype

- Chrome Manifest V3 extension built with WXT and React.
- On-demand DOM inspection of visible form controls.
- Shadow-DOM visual overlay with a field outline, tooltip and pointer line.
- Local document registry in browser IndexedDB. Adding a file does not trigger OCR or upload.
- Requirement-driven retrieval: only matching document categories are sent to the local OCR service when a form is scanned.
- Local OCR API using Tesseract.js, PDF.js and Sharp, bound to 127.0.0.1.
- Evidence-linked candidate facts and deterministic field mapping.
- Optional Gemini mapping endpoint. It is disabled unless configured and requires explicit consent.
- Human review before each field is filled. No auto-submit, CAPTCHA solving or portal-security bypass.

## Repository layout

- extension/: Chrome extension and UI.
- server/: local OCR and optional AI API.
- demo/: synthetic scholarship form for testing.
- docs/: architecture, privacy and development notes.

## Prerequisites

- Node.js 22.12+ or a current 24.x LTS release.
- npm.
- Google Chrome or Chromium.
- Optional: Gemini API key for the opt-in mapping experiment.

## Run locally

1. Install dependencies from the repository root: npm install
2. Create the local API environment file:
   - macOS/Linux: cp server/.env.example server/.env
   - Windows PowerShell: Copy-Item server/.env.example server/.env
3. Start the local OCR service in one terminal: npm run dev:server
4. Start the extension dev build in another terminal: npm run dev:extension
5. Open chrome://extensions, enable Developer mode, and load the generated directory: extension/.output/chrome-mv3-dev
6. Start the mock form from the repository root: py -m http.server 4173 --directory demo
7. Open http://127.0.0.1:4173/scholarship-form.html. Add synthetic documents to the extension, then scan the mock form.

## Important prototype safety note

Use synthetic documents only until a production-grade security review is complete. This prototype stores selected files in browser IndexedDB, which is not an encrypted document vault. The local OCR API is loopback-only but is a development service, not an internet-facing production API. The optional Gemini adapter sends only the selected extracted facts and field descriptors after the user explicitly opts in. Do not send Aadhaar, PAN, bank, income or other real personal data to an external model in this prototype.

The extension uses broad HTTP/HTTPS page matching for this prototype, but does not inspect a page until the user clicks Scan current page. Before release, restrict supported origins, minimize permissions, add a hardened local API pairing/authentication flow, encrypt stored files and facts, and conduct security and privacy testing.

## Current limitations

- OCR is English-first by default; regional-language packs and validation need to be added and evaluated.
- Candidate extraction uses conservative labelled-line heuristics, not a verified government-document model.
- Complex custom widgets, closed Shadow DOM, canvas-rendered forms and cross-origin frames may require manual assistance.
- File inputs are detected but cannot be populated by arbitrary JavaScript. FormSaathi guides the user to attach files manually.
- CAPTCHA, payment, final submission and other sensitive actions remain user-controlled.
- No eligibility decision is authoritative. Users must check scheme rules and official instructions.

## Checks

- npm run check:server validates local service JavaScript syntax.
- npm test runs candidate-extraction tests.
- npm run build:extension builds the Chrome extension.
- GitHub Actions runs these checks on pushes and pull requests to main.

See docs/ARCHITECTURE.md, docs/PRIVACY.md and docs/DEVELOPMENT.md.
