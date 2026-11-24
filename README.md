# FormSaathi

AI-assisted, privacy-first government form guidance and autofill prototype.

FormSaathi helps a citizen organize documents, inspect a web form, retrieve only document categories relevant to that form, extract evidence-backed facts locally, review proposed mappings, and fill fields only after explicit approval. It never automatically submits a government application.

## What is implemented

- Chrome Manifest V3 extension built with WXT and React.
- Local document vault in browser IndexedDB; adding a file does not trigger OCR or upload.
- Filename-based category suggestions with user-editable categories.
- On-demand inspection of visible inputs, textareas and select elements.
- Category-driven retrieval: only relevant document categories are sent to the local OCR service after the user scans a form.
- Local OCR API using Tesseract.js, PDF.js and Sharp, bound to 127.0.0.1.
- Conservative, evidence-linked extraction for a small set of labelled fields.
- Semantic field aliases and optional, consent-gated Gemini mapping.
- Shadow-DOM overlay with a field outline, tooltip and pointer line.
- Per-field review and approval before autofill.
- Image preparation: resize and compress a JPEG copy to portal-specified maximum dimensions and size.
- Synthetic scholarship form and a small extraction test.
- GitHub Actions workflow for server syntax checks, extraction tests and extension build.

## Repository layout

- extension/: Chrome extension and UI.
- server/: local OCR, optional AI mapping and image preparation API.
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
5. Open chrome://extensions, enable Developer mode, and load extension/.output/chrome-mv3-dev.
6. Start the mock form from the repository root: py -m http.server 4173 --directory demo
7. Open http://127.0.0.1:4173/scholarship-form.html. Add synthetic documents to the extension, then scan the mock form.

The first OCR run may download Tesseract language data. Keep the local service running while testing the extension.

## Current workflow

1. Add a PDF/image and choose or confirm its document category. Category can be suggested from the filename.
2. Open the mock form and click Scan current page.
3. FormSaathi inspects visible DOM controls, maps recognised field labels to information keys and selects documents in the corresponding categories.
4. Only those selected documents are sent to local OCR. Unrelated categories are left untouched.
5. Review each extracted value and its source evidence. Use Highlight on page to show its target.
6. Edit the value if needed and click Approve & fill this field. Each field requires its own approval.
7. For image uploads, set the maximum KB and dimensions, choose Prepare JPEG copy, and manually attach the downloaded copy on the portal.
8. Review the portal yourself and submit it yourself.

## Important prototype safety note

Use synthetic documents only until a production-grade security review is complete. Files and OCR caches are stored in browser IndexedDB, which is not an encrypted document vault. The local API is loopback-only and rejects foreign browser origins, but it is still a development service, not a production security boundary. The optional Gemini adapter sends selected extracted facts and field descriptors only after a confirmation. Do not send Aadhaar, PAN, bank, income or other real personal data to an external model in this prototype.

The extension uses broad HTTP/HTTPS page matching for this prototype, but does not inspect a page until the user clicks Scan current page. Before release, restrict supported origins, minimize permissions, add a hardened local API pairing/authentication flow, encrypt stored files and facts, and conduct security and privacy testing.

## Current limitations

- OCR is English-first by default; regional-language packs and document-specific evaluation are still needed.
- Candidate extraction uses conservative labelled-line heuristics, not a trained government-document model.
- Category retrieval is a first MVP. It does not yet distinguish every document subtype such as Class 10 versus Class 12 unless the user classifies them separately.
- Complex custom widgets, closed Shadow DOM, canvas-rendered forms and cross-origin frames may require manual assistance.
- File inputs are detected but cannot be populated by arbitrary JavaScript. FormSaathi prepares a copy and guides the user to attach it manually.
- Image preparation outputs JPEG only. PDF conversion and signature/photo presets are not implemented yet.
- CAPTCHA, payment, final submission and other sensitive actions remain user-controlled.
- No eligibility decision is authoritative. Users must check scheme rules and official instructions.

## Checks

- npm run check:server validates local service JavaScript syntax.
- npm test runs candidate-extraction tests.
- npm run build:extension builds the Chrome extension.
- GitHub Actions runs these checks on pushes and pull requests to main.

See docs/ARCHITECTURE.md, docs/PRIVACY.md and docs/DEVELOPMENT.md.
