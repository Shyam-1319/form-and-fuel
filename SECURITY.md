# Security policy

Do not submit secret values, real health records or exploit payloads containing personal data in public issues. Use the repository's private vulnerability reporting if enabled; otherwise contact the repository owner privately and describe the affected component without sensitive data.

Authentication uses Better Auth, hashed single-use OTPs and secure production cookies. Server-side ownership scopes every private entity. Secrets remain in Pages secret storage or ignored local files. Intervals credentials use authenticated AES-GCM encryption with owner-specific associated data. AI requires explicit requests and verified accounts. Imports never execute spreadsheet formulas or macros.

The public demo uses fictional client-only records. Service-worker caching excludes API routes. The code makes no HIPAA/GDPR certification, medical-accuracy, penetration-test, or universal security guarantee. Provider-managed logs and backups have their own retention policies. Account deletion removes active application data, not a promise of instant deletion from all provider backups.

Supported code is the latest reviewed main branch. Keep dependencies updated, rerun ownership/authentication tests on upgrades, and review Cloudflare, Groq, Resend and Intervals terms before production use. Do not enable paid services automatically. The free email test sender is unsuitable for public signup.
