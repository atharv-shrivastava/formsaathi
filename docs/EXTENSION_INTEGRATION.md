# Web app, extension and AI form-analysis integration

## Shared account

The web app and Chrome extension use the same Supabase project and user account. The extension authenticates through Supabase Auth using its own sign-in flow. It stores its own access/refresh token pair in extension-owned `chrome.storage.local`; it does not copy website cookies, local storage, passwords or tokens.

The extension refreshes expired sessions and clears its local session when the user disconnects. The Supabase publishable key is client configuration. Never put a service-role key or Gemini API key in the extension.

## Web document extraction and profile review

The web app processes supported uploads (PDF, JPG, PNG and WebP; maximum 10 MB) after the user confirms the processing notice. Selecting a vault category is for organisation only; it does not constrain field extraction.

1. The original upload is stored in the user's private Supabase Storage folder.
2. The authenticated web app sends the selected file to `POST /api/ocr` on the Node API.
3. The API extracts text using PDF text extraction or image OCR (RapidOCR, with Tesseract fallback for recoverable RapidOCR failures).
4. When `GEMINI_API_KEY` is configured, the Node API sends the OCR text to Gemini for broad labelled field/value extraction and document-type identification. The prompt treats document contents as untrusted data and instructs the model not to invent or rewrite values.
5. The backend validates proposed field values against evidence present in the OCR text, merges conservative rule-based candidates, and returns the candidates plus document type.
6. The web app stores every validated candidate in `public.extracted_facts` with its `document_id`, original `fact_label`, `fact_key`, value, confidence, evidence and pending review status.
7. The Information Profile page groups candidates by their source document. Users can edit, dismiss, select individual fields or bulk-select fields from one or more documents. Only selected fields are upserted into `public.profile_facts` with `verified = true`.
8. Previously approved or dismissed candidates remain attached to the document when OCR is rerun; only pending candidates are refreshed.

The extension does not read or OCR all web-vault documents on every webpage scan. It searches only the user's `verified = true` profile facts. Stored original field labels are used alongside fact keys to help match less-common fields (for example, a document's "Consumer Number" to a portal's "Consumer No."). The authenticated backend filters those saved facts to the detected webpage fields before Gemini proposes mappings.

If Gemini is not configured or its request fails, the API falls back to a limited set of labelled-line patterns. In that fallback mode it cannot promise broad extraction of every field and the response explicitly reports the limitation. OCR/Gemini results are candidates, not proof that a value is correct.

## Form scan request

When the user selects **Scan current page**, the content script collects visible control metadata only:

- Field ID, label and accessible name.
- Input/select/textarea type and required status.
- Placeholder and name attributes.
- Text labels for dropdown choices.

The scan does not read or transmit values already typed into the form. The extension does not send the complete DOM, form submission payload or cookies. Original document files are not sent as part of the webpage AI matching request.

After the user confirms the one-time AI consent prompt, the extension sends the field descriptors and page title to `POST /api/forms/analyze` on the hosted Node API. The request includes the current Supabase access token as a Bearer token.

## Backend processing

1. Express validates the Supabase access token and identifies the user.
2. The backend creates a Supabase client carrying that user's access token.
3. The backend queries `public.profile_facts` for `verified = true`. RLS scopes the query to the authenticated user; no client-supplied user ID is trusted.
4. Server-side filtering limits the model context to approved profile facts that appear relevant to the detected field descriptors.
5. The backend sends those relevant fact keys/values and field descriptors to Google Gemini using the server-side `GEMINI_API_KEY`.
6. Gemini returns only `fieldId`, `factKey` and a confidence score. It does not return personal values.
7. The backend validates that each field ID belongs to the scan, the fact key exists in the user's verified rows, confidence is at least 0.70, and dropdown values are exact listed options.
8. The backend returns the exact original stored value from Supabase with its source metadata.

The extension displays the suggestion and the user can edit or approve each field individually. FormSaathi never submits the government application.

## API contract

`POST https://formsaathi-ocr-api.onrender.com/api/forms/analyze`

Headers:

- `Authorization: Bearer <Supabase user access token>`
- `Content-Type: application/json`

Body:

```json
{
  "consent": true,
  "pageTitle": "Scholarship Application",
  "fields": [
    {
      "id": "fs-0-ab12cd",
      "label": "Name of Applicant",
      "tagName": "input",
      "inputType": "text",
      "required": true,
      "placeholder": "",
      "name": "student_name",
      "options": [],
      "isFile": false
    }
  ]
}
```

Response shape:

```json
{
  "mappings": [
    {
      "fieldId": "fs-0-ab12cd",
      "factId": "profile-fact-id",
      "factKey": "applicant_name",
      "value": "Stored verified value",
      "confidence": 0.93,
      "sourceDocumentId": "source-document-id",
      "updatedAt": "2026-11-26T00:00:00Z"
    }
  ],
  "aiUsed": true,
  "model": "gemini-3.5-flash-lite",
  "fieldCount": 1,
  "matchedCount": 1,
  "note": "AI suggestions use exact values from your verified profile."
}
```

## API key location

Set `GEMINI_API_KEY` in the Render environment for the **formsaathi-ocr-api** Node service. Optionally set `GEMINI_MODEL=gemini-3.5-flash-lite`. Do not add the key to Vite variables, WXT variables, extension source, GitHub files or browser storage.

The hosted route returns a clear configuration error until the key is present. The Gemini request is performed server-side.

## Privacy and abuse controls

- Every API request requires a valid Supabase user token.
- Supabase RLS restricts profile reads to the signed-in user.
- Only verified profile facts are considered.
- The backend filters facts to relevant field labels before sending anything to Gemini.
- AI use requires explicit consent at scan time.
- Typed form values and original documents are not sent to Gemini.
- The model cannot supply the final personal value; the backend returns the exact verified database value for a validated fact key.
- The routes are rate-limited per user and cap fields, options, profile facts and file sizes.
- File upload inputs, passwords, checkboxes and radio buttons are not suggested for autofill.
- The user checks every result and manually submits the official form.

## Mobile paper-form photo scanner

The signed-in web app includes a **Scan paper form** section. On a phone, the user can open the rear camera through an image file input with `capture="environment"`, or choose an existing JPG/PNG/WebP image from the gallery. The route accepts one image up to 10 MB.

The user must explicitly consent before the image and relevant approved profile facts are sent to Google Gemini. The backend:

1. Authenticates the Supabase user and reads only their `verified = true` profile facts under RLS.
2. Runs RapidOCR against the photo to obtain printed label lines.
3. Filters profile facts to those relevant to the OCR labels.
4. Sends the photo, relevant facts and OCR label list to the configured Gemini vision model.
5. Accepts only model placements that map to a verified fact and a matching OCR line, meet the confidence threshold, use bounded coordinates, and do not materially overlap another accepted placement.
6. Uses Sharp to rotate the image according to EXIF orientation and draw exact database values into the model-selected blank regions.
7. Returns a new JPEG as base64 plus the list of fields placed.

The photo is held in backend memory for this request and is not uploaded to the FormSaathi document vault. Gemini receives the photo and relevant profile values, so the consent text must make that external processing clear. No image or PDF is submitted to a government portal. The user reviews and downloads the new image; the original local photo remains unchanged.

### API contract

`POST https://formsaathi-ocr-api.onrender.com/api/forms/fill-image`

Use `multipart/form-data` with:
- `file`: JPG, PNG or WebP image, maximum 10 MB.
- `consent=true`: explicit opt-in.

Header: `Authorization: Bearer <Supabase user access token>`

Response includes:
- `image`: base64-encoded filled JPEG.
- `mimeType`, `width`, `height`.
- `placements`: field label, fact key, exact value and model confidence.
- `note`: review instructions.

### Environment variables

Set `GEMINI_API_KEY` on the Render `formsaathi-ocr-api` service. `GEMINI_VISION_MODEL` is optional and defaults to `GEMINI_MODEL`; the default model is `gemini-3.5-flash-lite`. Never put provider keys in the browser or extension.

Paper-form placement is best-effort. Perspective distortion, handwriting, stamps, dense layouts, multi-column pages and faint labels can result in incorrect or missing placements. The user must verify the image before printing or submitting it.

## Extension document OCR and image preparation

The extension's IndexedDB document vault remains separate from the web app's private Supabase Storage bucket. Files added from the extension stay in that browser unless the user scans a page and explicitly approves processing relevant documents through hosted OCR.

- The extension checks `GET /health` on the hosted Node API at `https://formsaathi-ocr-api.onrender.com`; it does not require a local server on the user's computer.
- After a separate consent prompt, relevant documents are sent one at a time to authenticated `POST /api/ocr` with the user's Supabase access token.
- The backend processes the file in memory, returns OCR text and unverified candidate facts, and does not save the uploaded file to its own disk. Candidates remain in the extension's browser-local vault until the user reviews them.
- Image preparation uses authenticated `POST /api/prepare-image` on the same hosted API. It also requires a connected FormSaathi account.
- Both routes use the same Render Node API as AI form matching. The extension must not call `127.0.0.1:8787` in its packaged build.

Do not upload sensitive real documents in this prototype unless you have reviewed the privacy and security implications.

## Installation and distribution

The repository CI builds and packages the extension. The development release is distributed as a ZIP for manual loading: extract it, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the folder containing `manifest.json`. A Chrome Web Store release is a separate submission/review step.
