# Privacy and security notes

This is a development prototype, not a production-ready citizen document vault.

## Data handling in this prototype

- Files are stored as Blobs in the browser extension's IndexedDB database.
- Adding a file does not invoke OCR or send it anywhere.
- After a form scan, the extension selects documents by required category. Only selected files are posted to the loopback service at 127.0.0.1.
- The local service uses in-memory uploads and does not write source files to disk.
- Extracted text and candidate facts are cached in IndexedDB so repeat scans do not need to rerun OCR.
- Image preparation processes a selected image in memory and returns a JPEG copy to the browser for download. The original vault document is unchanged.
- The optional Gemini route sends extracted facts and detected field descriptors only after explicit confirmation. Do not use this route with real personal data in the prototype.
- Deleting a document removes its IndexedDB record. Browser storage is not secure erasure and may be subject to browser profile backups or device compromise.

## Before using real citizen data

1. Add strong local-service pairing/authentication and strict extension-origin allowlisting.
2. Add encryption at rest with a user-controlled key lifecycle; do not store secrets in source code.
3. Add authenticated user accounts only if a remote service is introduced. Do not expose the local OCR server publicly.
4. Publish a clear data inventory, purpose limitation, retention schedule, export and deletion workflow.
5. Evaluate applicable Indian privacy and identity-data requirements with qualified counsel/security reviewers.
6. Test malicious PDFs/images, prompt injection embedded in document text, hostile webpages, dependency supply-chain risks and browser permission scope.
7. Avoid logging file contents, extracted values, IDs, addresses, account numbers or session data.
8. Use synthetic documents and mock portals in demos and automated tests.

## User control

The system asks before using external AI, requires per-field approval before filling and never submits the form. CAPTCHA, payment, authentication and official attestation remain the applicant's responsibility.
