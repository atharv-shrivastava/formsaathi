# Development guide

## Local setup

Use a current Node.js LTS release. From the repository root:

    npm install
    cp server/.env.example server/.env
    npm run dev:server

In another terminal:

    npm run dev:extension

Load the generated Chrome MV3 development directory from extension/.output/chrome-mv3-dev at chrome://extensions.

## Test workflow

1. Prepare synthetic sample documents with labelled lines such as Applicant Name, Date of Birth and Annual Family Income.
2. Add each file to the vault and choose its category. Confirm the UI reports that OCR has not run.
3. Open a mock form with a subset of fields.
4. Click Scan current page. Confirm only categories required by the detected fields are OCR-processed.
5. Select Highlight on page and check the outline follows the field while scrolling.
6. Edit a suggested value, then approve and fill one field at a time.
7. Verify dropdown matching only succeeds on an exact option. File inputs should remain manual.

## Current OCR scope

The server supports images and PDFs. PDFs with embedded text use PDF text extraction; image-only pages are rendered and sent through Tesseract. English is configured by default. Add language packs only after preparing a representative evaluation set.

## Development checklist

- [ ] Add unit tests for alias mapping and candidate extraction.
- [ ] Add extension tests for dynamic forms, frames and scroll/zoom behavior.
- [ ] Add an API pairing token and strict origin allowlist.
- [ ] Restrict matches to supported domains for release.
- [ ] Add per-document language selection and OCR quality evaluation.
- [ ] Add source-page/region highlighting in the review UI.
- [ ] Add proper encrypted storage and key lifecycle before real PII use.
- [ ] Review all dependency and model licences before distribution.
