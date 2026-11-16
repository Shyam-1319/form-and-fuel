# Delivery checklist

## Completed
- [x] Inspect workspace, preserve unrelated files, verify Node/npm/Git.
- [x] Dedicated project, maintained dependencies, lockfile and deployment scripts.
- [x] Pages Functions, D1 migrations, verified-session ownership and exports/deletion.
- [x] Auth lifecycle tested using mocked email delivery and real local D1.
- [x] Meals, recipes, weights, water, settings and deterministic calculations.
- [x] Workout plans, reviewed multi-sheet import and independent session snapshots.
- [x] Accessible circumference map with history and unit conversion.
- [x] Encrypted Intervals credentials and resumable, duplicate-safe sync with mocked tests.
- [x] Groq adapter, quotas, editable previews, guarded photo input and temporary review.
- [x] Fictional demo, actual screenshots, PWA, light/dark responsive UI.
- [x] Types, lint, 20 unit/integration tests, 4 browser workflows and build pass.
- [x] Documentation, engineering and portfolio notes, source review and public GitHub push.
- [x] Cloudflare deployment, live route loading and real D1 health verified.
- [x] Successful remote GitHub Actions run observed.

## Blocked / unverified
- [ ] Production secrets: Wrangler still lists none for this Pages project's Production environment.
- [ ] Real email delivery, signup, reset and private persistence after secret configuration/redeployment.
- [ ] Owned sending domain for public multi-user email; test sender only is configured.
- [ ] Groq key, account/model access and real text/vision checks; AI remains disabled.
- [ ] Personal Intervals connection and actual imported metrics/date ranges.

## Explicit limitations
No offline write queue, scheduled jobs, OAuth client or arbitrary-workbook interpretation guarantee. Body-map baseline uses loaded history until earlier pages load. Workout actual-entry units are explicitly kg/metres/seconds. Source sleep stages and timing are not currently normalized. No readiness/BioCharge or missing data is invented.
