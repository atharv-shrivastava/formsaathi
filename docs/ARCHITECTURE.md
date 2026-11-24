# FormSaathi architecture

## Design goal

The browser extension and document-processing service are independent. The extension owns page inspection, user interaction, IndexedDB document storage and visual guidance. The loopback service owns OCR, image preparation and optional external-AI orchestration.

## Runtime flow

1. User adds PDF/image documents and chooses or confirms a category. Filename keywords can suggest a category. The original Blob is saved to extension IndexedDB. No OCR or network request runs on upload.
2. User clicks Scan current page. The content script inspects visible input, textarea and select controls and returns labels, types, required state and dropdown options. It does not read existing field values.
3. The extension maps field labels to known information keys and derives required document categories.
4. Only documents in those categories are selected from IndexedDB and sent one at a time to the loopback OCR API. Unrelated categories are not sent.
5. OCR returns raw text and conservative candidate facts. The extension caches results locally with the document record.
6. Deterministic aliases map candidate facts to portal fields. Optional Gemini mapping is separately gated by an explicit confirmation. Original files are not sent to Gemini.
7. The applicant edits/reviews each proposed value, highlights the target field and clicks Approve & fill this field.
8. The content script uses the native DOM setter and dispatches input/change events. It never clicks a submit button.
9. For image upload constraints, the user requests a JPEG copy with max KB and max dimensions. Sharp processes it in memory and returns it for local download. The applicant attaches it manually.

## Modules

- extension/entrypoints/content.ts: DOM discovery, element highlighting and single-field fill.
- extension/entrypoints/sidepanel: document vault and review interface.
- extension/lib/db.ts: IndexedDB file storage.
- extension/lib/mapping.ts: field aliases, filename categorization and category-based retrieval.
- server/src/ocr.js: image/PDF extraction and OCR.
- server/src/facts.js: labelled-line candidate extraction.
- server/src/prepare.js: JPEG resize/compression.
- server/src/index.js: local API and opt-in Gemini adapter.

## Normalized field model

Each field descriptor includes a transient ID, visible label, tag name, input type, required flag, placeholder, name and select options. Current field values are deliberately not collected.

## Safety boundaries

- The AI endpoint returns suggestions only. It cannot invoke browser actions.
- File inputs are detected but cannot be autofilled by the extension.
- No CAPTCHA solving, anti-bot bypass, credential handling or final submission automation.
- If a target is missing or ambiguous, the user must rescan or fill manually.
- Cross-origin frames and inaccessible custom controls may not be visible to this content script.
- Visual overlays use viewport measurements and may need recalibration on dynamic pages.

## Planned next engineering steps

- Add an OCR document classification stage and richer per-file metadata (e.g. Class 10 marksheet vs Class 12 marksheet).
- Add source-page/region provenance and discrepancy comparison across documents.
- Add VLM screenshot fallback with user-confirmed target selection.
- Add a local API pairing token and encrypted vault before real personal data is considered.
- Add regional language OCR and test it against a labelled evaluation corpus.
