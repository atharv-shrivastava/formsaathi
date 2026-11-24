# Development guide

## Prerequisites

- Node.js 22.12+ or a current 24.x LTS release.
- pnpm 12.22.0.
- Google Chrome or Chromium.

Install the pinned package-manager version if needed:

    npm install --global pnpm@12.22.0

## Local setup

From the repository root:

    pnpm install
    Copy-Item server/.env.example server/.env
    pnpm dev:server

On macOS/Linux, use:

    cp server/.env.example server/.env

In another terminal:

    pnpm dev:extension

Load the generated Chrome MV3 development directory from extension/.output/chrome-mv3-dev at chrome://extensions.

## Run the mock scholarship form

Start a simple static server from the repository root:

    py -m http.server 4173 --directory demo

Open http://127.0.0.1:4173/scholarship-form.html. The demo contains fictitious data fields and a file upload control. Do not enter personal information.

## Test workflow

1. Prepare synthetic sample documents with labelled lines such as Applicant Name, Date of Birth and Annual Family Income.
2. Add each file to the vault and choose the category. Confirm the UI reports that OCR has not run.
3. Open the mock scholarship form and click Scan current page.
4. Confirm only categories required by the detected fields are OCR-processed.
5. Select Highlight on page and check the outline follows the field while scrolling.
6. Edit a suggested value, then approve and fill one field at a time.
7. Verify dropdown matching only succeeds on an exact option. File inputs should remain manual.

## Commands

- pnpm dev:server: run the local OCR API.
- pnpm dev:extension: run the Chrome extension dev build.
- pnpm build:extension: build the extension.
- pnpm check:server: check backend JavaScript syntax.
- pnpm test: run candidate extraction tests.

## Current OCR scope

The server supports images and PDFs. PDFs with embedded text use PDF text extraction; image-only pages are rendered and sent through Tesseract. English is configured by default. Add language packs only after preparing a representative evaluation set.

## Development checklist

- [ ] Generate and commit pnpm-lock.yaml, then use frozen-lockfile in CI.
- [ ] Add unit tests for field alias mapping and more document layouts.
- [ ] Add extension tests for dynamic forms, frames and scroll/zoom behavior.
- [ ] Add a local API pairing token and strict origin allowlist.
- [ ] Restrict matches to supported domains for release.
- [ ] Add per-document language selection and OCR quality evaluation.
- [ ] Add source-page/region highlighting in the review UI.
- [ ] Add properly encrypted storage and key lifecycle before real PII use.
- [ ] Review all dependency and model licences before distribution.
