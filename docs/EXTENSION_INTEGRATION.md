# Web app and extension integration

## Shared account

The web app and Chrome extension use the same Supabase project and the same user account. The extension has its own sign-in form and authenticates with the user's email and password through Supabase Auth. It does not copy the web app's browser session, cookies, password, or tokens from the website.

The extension stores its own access/refresh token pair in extension-owned `chrome.storage.local`, refreshes expired sessions through Supabase Auth, and clears its local session on disconnect. The Supabase publishable key is client-side configuration, not a secret. Never place a service-role key in the extension.

## Profile data access

The web app remains the source of truth for approved profile facts. During a form scan, the extension:
1. Detects supported visible form controls.
2. Converts recognised labels to canonical profile keys.
3. Requests only those keys from `public.profile_facts`.
4. Filters to `verified = true`.
5. Relies on the existing Supabase row-level security policy to restrict the response to the signed-in user.
6. Shows matched values with an evidence/source label and requires the user to approve each fill.

The extension does not send a `user_id` filter as proof of ownership and does not download the user's original cloud documents for a normal form-fill request.

The REST query selects `id,fact_key,fact_value,source_document_id,confidence,updated_at`, filters `verified=eq.true`, and restricts `fact_key` to recognised fields on the current page. The table's owner policy remains the authorisation boundary.

## Separate local document vault

The extension's IndexedDB document vault is still separate from the web app's private Supabase Storage bucket. Files uploaded directly into the extension remain in that browser. The extension's existing OCR/image-preparation helper still targets the local development service at `127.0.0.1:8787`; it is not a hosted extension OCR route. Cloud profile synchronisation works independently of that local service.

## Installation and distribution

The repository CI builds the extension and packages a ZIP. The development release is distributed as a ZIP for manual loading: extract it, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the folder containing `manifest.json`.

This is not a Chrome Web Store installation. Public one-click installation requires a Chrome Web Store developer account, a submitted package, and store review.

## Security boundaries

- The publishable key is public client configuration. Never include a Supabase service-role key or private server token.
- Keep the extension's refresh token in extension-owned storage, not website local storage, content-script page globals, or query strings.
- Query only verified fields needed for the current page.
- Do not add broad document-vault download access to ordinary form scans.
- A user must review values and manually submit the government form.
