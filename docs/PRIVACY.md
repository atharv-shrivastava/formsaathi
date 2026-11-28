# Privacy and security notes

FormSaathi handles identity, education, income and banking information. The MVP uses synthetic documents for public demos. Do not use real Aadhaar, PAN, bank or income documents until the deployment and access controls have been reviewed.

## Web app data handling

- Supabase Auth provides account sign-in.
- Original PDFs/images are uploaded only after the user selects a file and confirms the action.
- Files are stored in a private Supabase Storage bucket, not a public bucket.
- Storage paths begin with the authenticated user's UUID. RLS policies restrict Storage operations to that user's folder.
- User-owned Postgres tables have RLS policies matching `auth.uid()`.
- The browser uses the Supabase publishable key only. Never expose the service-role/secret key.
- OCR runs only when the user clicks Run OCR. The web app sends the selected file to the local OCR service.
- OCR candidates remain pending. Only a field the user approves is copied into the reviewed profile.
- The Privacy Centre can remove the user's uploaded files, document rows, extracted candidates, reviewed values and application tracker entries.

Supabase private Storage and RLS provide access control; they do not make this MVP end-to-end encrypted. The project has not had an independent security audit. Review provider retention, backups, account recovery, logging, key management and applicable legal requirements before handling real personal data.

## Local OCR service

- The existing OCR service binds to `127.0.0.1` and processes uploads in memory.
- It does not authenticate requests and is intended only for local development.
- Do not expose this service to the public internet. A hosted OCR API must authenticate the user, verify document ownership and enforce upload/rate limits before deployment.
- The optional Gemini route sends extracted facts and field descriptors only after explicit consent. Do not use this route with real personal data in the prototype.

## Extension

- The current extension stores documents in browser IndexedDB and is not yet paired with web accounts.
- A future account-pairing flow must use browser-supported OAuth/PKCE or a short-lived one-time pairing code.
- Store extension credentials only in extension-owned storage, support session revocation and never expose tokens to webpage scripts.
- The extension should retrieve only verified fields needed by the active form, not download the entire document vault.
- The extension requires per-field user approval and never submits an application.

## Before public release

1. Verify isolation by testing two independent Supabase accounts against every table and Storage operation.
2. Add account deletion, password recovery, MFA/session management and an explicit retention schedule.
3. Add an authenticated, rate-limited hosted OCR service before moving processing off-device.
4. Avoid logging file contents, extracted values, addresses, account numbers or tokens.
5. Test malicious PDFs/images, prompt injection embedded in document text, hostile webpages and dependency supply-chain risks.
6. Publish a clear data inventory, processing purpose, provider list and deletion/backup-retention explanation.
7. Review applicable Indian privacy and identity-data requirements with qualified counsel and security reviewers.
