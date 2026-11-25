# FormSaathi architecture

## Product boundary

FormSaathi has two interfaces:

- `web/` is the account and document-management workspace. It is the source of truth for account-owned documents, OCR candidate facts and user-reviewed profile facts.
- `extension/` inspects supported browser forms, guides the user and performs field-level autofill after explicit approval. It is not yet connected to web accounts; the pairing and data API are the next milestone.

The `server/` provides the OCR, image-preparation and optional AI-mapping API. Hosted requests require a valid Supabase access token, a configured browser origin, upload-type validation and per-user rate limits. The service uses the Supabase publishable key only to verify user sessions; it does not use a service-role key.

## Web app data flow

1. Supabase Auth creates the user session.
2. The browser uploads a selected PDF/image to a private Storage bucket under a folder named with the authenticated user's UUID.
3. The browser inserts document metadata into `public.documents`; RLS requires `user_id = auth.uid()`.
4. OCR runs only after the user selects Run OCR. The web app downloads that one file from private Storage and sends it over HTTPS to the hosted OCR API with the current user's Supabase access token. The service validates the PDF/image signature, enforces a 10 MB limit and per-user rate limits, and processes the upload in memory without writing the document to its service filesystem.
5. Candidate values are saved in `public.extracted_facts` with status `pending`.
6. The user reviews each candidate and explicitly approves it. Approved values are upserted into `public.profile_facts`.
7. The extension integration will retrieve only requested verified facts under the same user's RLS-protected session.

## Supabase data model

- `profiles`: user display name and language preference.
- `documents`: owner, file name, category, MIME type, byte size, private storage path and processing status.
- `extracted_facts`: OCR candidate facts, evidence, confidence and review status.
- `profile_facts`: one user-reviewed value per fact key, with source document and confidence.
- `applications`: a simple personal progress tracker.

The migration in `supabase/migrations` enables RLS on every user-owned table and creates a private `formsaathi-documents` bucket with owner-folder policies. The web app uses only the Supabase publishable key. A service-role/secret key must never be exposed in browser code.

## Current extension architecture

1. User adds PDF/image documents and chooses or confirms a category. The original Blob is saved to extension IndexedDB. No OCR or network request runs on upload.
2. User clicks Scan current page. The content script inspects visible input, textarea and select controls and returns labels, types, required state and dropdown options. It does not read existing field values.
3. The extension maps field labels to known information keys and derives required document categories.
4. Only documents in those categories are selected from IndexedDB and sent one at a time to the loopback OCR API. Unrelated categories are not sent.
5. OCR returns raw text and conservative candidate facts. The extension caches results locally with the document record.
6. Deterministic aliases map candidate facts to portal fields. Optional Gemini mapping is separately gated by an explicit confirmation. Original files are not sent to Gemini.
7. The applicant edits/reviews each proposed value, highlights the target field and clicks Approve & fill this field.
8. The content script uses the native DOM setter and dispatches input/change events. It never clicks a submit button.
9. File inputs are detected but must be attached manually.

## Next integration milestone

Implement a deliberate extension-account pairing flow using a browser-supported OAuth/PKCE or one-time pairing flow. The extension must store credentials in extension-owned storage, support revocation, and request only verified profile facts required by the current form. Do not share the website's refresh token with page scripts or put tokens in URLs. See `docs/EXTENSION_INTEGRATION.md`.

## Safety boundaries

- AI and OCR return suggestions only; they cannot invoke browser actions.
- Candidate values remain pending until user approval.
- Conflicting source values must be shown for human resolution.
- No CAPTCHA solving, anti-bot bypass, credential handling or final submission automation.
- If a target is missing or ambiguous, the user must rescan or fill manually.
- Cross-origin frames and inaccessible custom controls may not be visible to the current content script.
