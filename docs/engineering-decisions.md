# Engineering decisions

## Pages, Functions and D1

The Vite build emits public static assets. A catch-all **Pages Function** handles `/api/*` with a `DB` D1 binding. This follows the required deployment architecture; no standalone Worker or cron service is provisioned. Same-origin cookies reduce cross-origin configuration. The default Pages SPA fallback supports direct routes; no custom 404 file or looping redirect rule is used.

## Ownership and records

Better Auth identifies the verified user. Every record query, mutation and export uses that identity; request-body user IDs are ignored. Validated JSON payloads sit in a shared records table with an explicit kind constraint, owner foreign key, date and source indexes. This keeps related CRUD understandable without proliferating near-identical tables. The tradeoff is less SQL-level field validation: Zod validates every editable payload at the server boundary. Dates, sums and chart aggregation are deterministic code/SQL.

Creates use a per-user request ID with a unique constraint. Updates require the previous update timestamp to detect stale editors. Source upserts use stable per-user source identifiers. An activity can link to only one diary session. Deleting a plan does not affect the independent planned snapshot stored in completed sessions.

## Authentication

Better Auth’s Drizzle adapter maps booleans and millisecond timestamps to D1. Adapter transactions are disabled because D1 does not support ordinary interactive SQL transactions; related application changes use atomic `DB.batch`. The library hashes passwords. Hashed email OTPs provide expiring, single-use verification and reset instead of reusable verification JWT links. Registration has a generic response to avoid confirming whether an email exists. Sessions expire; password resets revoke prior sessions. Explicit origin checks, secure production cookies and persisted rate limits protect mutations.

## Integration credentials

AES-256-GCM uses a random 96-bit nonce and user ID as authenticated associated data. D1 stores only ciphertext; a base64 32-byte application secret remains in Pages secret storage. The original API key is never returned. Keys cannot be moved between users successfully. Lost/rotated encryption keys require a migration or reconnection strategy. The initial per-user API-key flow is not a claim of provider-approved public OAuth access.

## Resumable imports and freshness

The user chooses the earliest relevant date. Bounded forward 30-day windows avoid infinite historical searching. A lease acquired by an atomic conditional update prevents duplicate concurrent work. Writes check the lease so disconnect cannot recreate cached records. A cursor advances only after validated upserts; replay after partial failure is duplicate-safe. Errors retain all cached history and back off; Retry-After is respected. Source-account provenance prevents mixing retained records with another athlete. Earliest/latest dates are computed from imported observations, never from fetch success alone.

The upstream adapter whitelists useful fields rather than persisting entire sensitive payloads. Unknown metric fields are not guessed. `hrv` maps to rMSSD and `hrvSDNN` to SDNN, both milliseconds. Only documented workout `calories` are normalized; active energy and total daily expenditure remain unavailable rather than fabricated. Nutrition targets never change automatically.

## AI boundary

A small provider interface separates Groq HTTP transport from request policy and validation. All requests are server-side, opt-in and verified-account-only. User text, workbook contents and provider notes are data, not instructions. Structured output is still validated with Zod. A generated meal only enters browser preview state; only the normal explicit save creates a diary record. Reviews are not saved. Photos are resized and re-encoded in the browser, checked by size/signature/dimensions on the server, forwarded only on request and never persisted.

Quotas use atomic conditional SQL increments. Both global and per-user limits are needed because the free account is shared. There is no paid fallback, automatic billing, automatic retry loop or silent provider switch. Weekly review sends small deterministic summaries rather than raw notes or full diaries. Real model and email delivery checks remain separate from mocked tests.

## Time, units and missing data

Diary dates are calendar dates in the selected IANA timezone, with an explicit meal time. Changing profile timezone does not rewrite past entries. Imported activity dates remain provider-local. Canonical storage uses kg, cm, ml, metres, seconds, grams and kcal; UI conversions use fixed factors. Date-only boundaries are tested across timezone/DST examples. Missing values remain null/unknown; a supplied zero stays zero. Averages exclude missing values and declare their denominators. Monthly nutrition/water totals are divided by logged days, not all calendar days.

## Measurement map

The original segmented SVG has named front/back regions, separate limb sides, hover/focus/tap selection, visible focus and a table alternative. Circumference labels describe real measurements, not isolated muscle sizes. History uses recorded-date bars rather than a line implying daily sampling. Change indicators are neutral. The visible baseline is the earliest loaded observation; earlier history can be loaded explicitly.

## Import review

ExcelJS and Papa Parse load `.xlsx` and CSV files only. Uploads have compressed/expanded limits, sheet/row/column caps, and no macro formats. Formula expressions become inert text. Multiple sheets, merged headings and outside-table notes are retained. Column mapping proposes a draft; an editable plan preview is required before saving. Unknown material remains source notes with warnings. Exercise mode defaults to strength but is called out for review; it cannot be assumed for arbitrary spreadsheets. Original formula expressions may need manual correction.

## Demo and privacy

The demo initializes synthetic fixtures in React state and does not call private APIs. Reload/reset discards changes; simulated AI is clearly identified. The service worker caches public app assets and excludes `/api` entirely. Logout reloads the page, clearing application memory. JSON exports stream bounded pages and omit secrets, hashes and sessions. Account deletion cascades active records and removes relevant token/rate data; actual provider backup retention is outside that active-data transaction.

## Tradeoffs

This is a deliberately small deployment, not a claim of unlimited scale. D1 query/row limits, free Pages CPU limits, workbook parsing memory, conservative AI budgets and provider quotas matter. Password hashing can exceed free CPU budgets under some runtime conditions and requires a live auth test. The workbook parser is a large but lazy chunk. Request-driven imports stop without browser requests; no automatic background scheduler is implied. No performance, accuracy, coverage or business-impact percentage is claimed.

Official sources: [Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/), [Better Auth D1-compatible adapters](https://better-auth.com/docs/adapters/other-relational-databases), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [email OTP](https://better-auth.com/docs/plugins/email-otp), [Groq structured outputs](https://console.groq.com/docs/structured-outputs), [Groq limits](https://console.groq.com/docs/rate-limits), [Groq data](https://console.groq.com/docs/your-data), [Intervals API guide](https://forum.intervals.icu/t/api-access-to-intervals-icu/609), [Intervals API schema](https://intervals.icu/api/v1/docs), [Resend domains](https://resend.com/docs/dashboard/domains/introduction). Reviewed during implementation on 2026-11-16; recheck before enabling integrations or upgrading dependencies.
