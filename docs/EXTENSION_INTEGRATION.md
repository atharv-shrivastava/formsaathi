# Web app, extension and AI form-analysis integration

## Shared account

The web app and Chrome extension use the same Supabase project and user account. The extension authenticates through Supabase Auth using its own sign-in flow. It stores its own access/refresh token pair in extension-owned `chrome.storage.local`; it does not copy website cookies, local storage, passwords or tokens.

The extension refreshes expired sessions and clears its local session when the user disconnects. The Supabase publishable key is client configuration. Never put a service-role key or Gemini API key in the extension.

## Form scan request

When the user selects **Scan current page**, the content script collects visible control metadata only:

- Field ID, label and accessible name.
- Input/select/textarea type and required status.
- Placeholder and name attributes.
- Text labels for dropdown choices.

The scan does not read or transmit values already typed into the form. The extension does not send the complete DOM, form submission payload, cookies or original document files.

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
- The route is rate-limited per user and caps fields, options and profile facts.
- File upload inputs, passwords, checkboxes and radio buttons are not suggested for autofill.
- The user checks every result and manually submits the official form.

## Separate local document vault

The extension's IndexedDB document vault remains separate from the web app's private Supabase Storage bucket. Files uploaded directly into the extension remain in that browser. Existing extension OCR/image-preparation helpers still use the local development API at `127.0.0.1:8787`; the cloud AI form-analysis route is a separate hosted path.

## Installation and distribution

The repository CI builds and packages the extension. The development release is distributed as a ZIP for manual loading: extract it, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the folder containing `manifest.json`. A Chrome Web Store release is a separate submission/review step.
