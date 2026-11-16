# Contributing

Use Node 24+ and `npm ci`. Work on a branch. Run `npm run check` and `npm run test:browser` for relevant changes. External-provider tests must use synthetic fixtures and mocks; never depend on real accounts or production secrets in CI.

Add a versioned migration for schema changes. Preserve user data; do not reset production. Include ownership, missing-value and idempotency cases when changing API paths. Review UI changes at mobile and desktop sizes and maintain keyboard access. Keep pending features separate from delivered claims.

Before a commit, inspect staged files for credentials, databases, exports, private screenshots and logs. Only synthetic screenshots and sample workbooks belong in source control. Explain the trigger, resulting behavior and actual validation in pull requests. Do not claim CI success without seeing the run finish.
