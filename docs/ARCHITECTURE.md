# FormSaathi architecture

## Design goal

The browser extension and the document-processing service are independent. The extension owns page inspection, user interaction, IndexedDB document storage and visual guidance. The local service owns OCR and optional external-AI orchestration.

## Runtime flow

1. User uploads PDF/image documents and manually assigns categories. The original Blob is saved to extension IndexedDB. No OCR or network request runs on upload.
2. User clicks Scan current page. The content script inspects visible input, textarea and select controls and returns labels, types, required state and dropdown options. It does not read existing field values.
3. The extension maps field labels to known information keys and derives required document categories.
4. Only documents in those categories are selected from IndexedDB and sent one at a time to the loopback OCR API. Unrelated documents are not sent.
5. OCR returns raw text and conservative candidate facts. The extension caches results locally with the document record.
6. Deterministic aliases map candidate facts to portal fields. Optional Gemini mapping is separately gated by an explicit browser confirmation. Original files are not sent to Gemini.
7. The applicant edits/reviews each proposed value, highlights the target field and clicks Approve & fill this field.
8. The content script uses the native DOM setter and dispatches input/change events. It never clicks a submit button.

## Modules

- extension/entrypoints/content.ts: DOM discovery, element highlighting and single-field fill.
- extension/entrypoints/sidepanel: document vault and review interface.
- extension/lib/db.ts: IndexedDB file storage.
- extension/lib/mapping.ts: alias rules and category-based retrieval.
- server/src/ocr.js: image/PDF preprocessing and OCR.
- server/src/facts.js: labelled-line candidate extraction.
- server/src/index.js: local API and opt-in Gemini adapter.

## Normalized field model

Each field descriptor includes a transient ID, visible label, tag name, input type, required flag, placeholder, name and select options. Current field values are deliberately not collected.

## Safety boundaries

- The AI endpoint returns suggestions only. It cannot invoke browser actions.
- File inputs are detected but cannot be autofilled by the extension.
- No CAPTCHA solving, anti-bot bypass, credential handling or final submission automation.
- If a target is missing or ambiguous, the user must rescan or fill manually.
- Cross-origin frames and inaccessible custom controls may not be visible to this content script.
