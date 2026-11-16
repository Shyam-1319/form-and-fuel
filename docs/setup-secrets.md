# User-driven configuration and live checks

Never send secret values in chat, tickets or screenshots.

1. Cloudflare → Workers & Pages → `form-and-fuel-shyam` → Settings → Variables and Secrets → **Production**. Add and save `BETTER_AUTH_SECRET`, `INTEGRATION_ENCRYPTION_KEY` and `RESEND_API_KEY` as secrets. A pending unsaved edit or Preview-only setting will not appear in production `wrangler pages secret list`.
2. Generate a high-entropy auth secret and a base64 32-byte encryption key locally, then store them in your password manager and the secret fields. Do not reuse the repository's ignored local development values for production.
3. In Resend, create an email-sending API key. For development, `onboarding@resend.dev` sends only to the Resend account owner's address. For real multi-user signup, verify a domain you control and use a sender on that domain. Change the tracked non-secret `EMAIL_FROM` and redeploy.
4. For optional AI, create a Groq free account without enabling paid billing, review its current data terms/limits and model access, add `GROQ_API_KEY` as a server secret, then explicitly enable `AI_ENABLED`. Only enable `AI_VISION_ENABLED` after a controlled image test on the chosen supported model. Manual logging does not depend on this.
5. Redeploy after configuration. Open the production origin, sign up yourself, receive and enter the email code, sign in, save a non-sensitive test meal, refresh and verify persistence. Request a reset, check delivery, confirm old sessions stop working, and sign out. Do not ask an agent to read your password or verification code.
6. Enter your Intervals.icu key only in authenticated Settings. Choose a history start date, verify the account and run the first bounded import. Inspect the actual imported source dates/fields; do not infer missing Zepp metrics. Revoke/disconnect a test connection if no longer wanted.

The agent can check configured secret **names**, anonymous HTTP responses, D1 schema availability and isolated automated tests. Real delivery, personal integration credentials and provider account access require these owner-driven steps.
