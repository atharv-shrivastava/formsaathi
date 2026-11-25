# Web app and extension integration

## Source of truth

The web app is the first account-facing interface. Supabase Auth identifies the user; the private Storage bucket holds original documents; Postgres stores document metadata, OCR candidates and only the facts the user has reviewed.

The extension must not query or download the full document vault for a normal form-fill request. It should request only verified profile facts matching the current form fields.

## Shared data model

- `profiles`: account-level preferences.
- `documents`: file metadata and private storage path.
- `extracted_facts`: OCR candidates linked to a source document. These are not trusted by default.
- `profile_facts`: user-reviewed values, unique by user and fact key.
- `applications`: the user's personal application tracker.

Every table has row-level security. The `formsaathi-documents` bucket is private; files are stored below a first-level folder equal to the authenticated user's UUID.

## Planned extension connection

The next extension milestone will add a deliberate account-pairing flow. Do not copy the web app's session or refresh token into extension source code, local storage shared with webpages, or query strings. Use a browser-supported OAuth/PKCE or one-time pairing flow, persist only extension-owned credentials in extension storage, and support revocation.

Once paired, the extension can use the user's Supabase access token and publishable key to query `profile_facts` under RLS. It should request only keys detected on the current form, require the user to approve the values, and never request original documents unless a separate, explicit action requires them.

Suggested read shape after pairing:

```http
GET /rest/v1/profile_facts?select=fact_key,fact_value,source_document_id,confidence&verified=eq.true&fact_key=in.(applicant_name,date_of_birth)
apikey: <Supabase publishable key>
Authorization: Bearer <user access token>
```

The request is not implemented in the extension yet. RLS remains the authorization boundary; a user ID supplied by the extension must never be treated as proof of ownership.

## Development boundary

The current OCR route is a local development service on `127.0.0.1:8787`. It is not a hosted production OCR API and does not authenticate requests. Do not expose it publicly. A hosted OCR endpoint must verify the user's access token, enforce upload limits and owner-scoped storage access, avoid logging document contents, and be deployed only after security review.
