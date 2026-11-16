# Portfolio notes

## Short description

Form & Fuel is a React/TypeScript health journal using Cloudflare Pages Functions and D1. It combines private nutrition, training and measurement records with opt-in Groq estimates and per-user wearable imports. A separate fictional demo lets reviewers explore without accessing personal data.

## Résumé bullets grounded in the implementation

- Built a React/TypeScript health journal on Cloudflare Pages Functions and D1 with verified accounts, server-enforced record ownership, private exports and account deletion.
- Implemented editable AI nutrition previews, deterministic totals, reviewed multi-sheet workout imports and an accessible SVG measurement history map.
- Developed encrypted per-user Intervals.icu connections with resumable, duplicate-safe imports and tests for isolation, missing data, session lifecycle and demo workflows.

Use deployment/integration claims only after checking the current verification record. Do not claim real users, measured health outcomes, model accuracy, performance improvements or a passing remote CI run without evidence.

## Two-minute walkthrough

Start at `/demo` and point out the fictional-data label. Explain why demo state is separate from authenticated APIs. Open Add Meal, show an editable estimate, cancel it, and explain that analysis cannot save a diary entry. Open the measurement map and use the keyboard to select a circumference region and inspect recorded dates. Import the sample workbook, show multiple sheets and outside-table notes, then explain the required review step.

Show the architecture diagram: public static assets on Pages, same-origin Functions, Better Auth sessions and D1. Explain that ownership comes from the verified session, not request parameters. For wearables, describe the user-selected start date, bounded windows, durable cursor and duplicate-safe upserts. Highlight the difference between source freshness and website fetch time, and between workout calories and daily expenditure. Finish with actual test results and current provider/email limitations.

## Five interview questions

1. **How do you prevent cross-user access?** Private routes resolve a verified session and bind its user ID into every query. Ownership checks happen before reads, writes and deletes. Integration tests attempt the same operations as a different user and verify denial.
2. **Why not let AI compute the dashboard?** Totals, units, time grouping and volume have deterministic rules. AI is reserved for uncertain food estimation and optional qualitative reviews, with explicit consent and validation.
3. **What happens if sync fails halfway?** Successfully cached records remain. The cursor does not advance until the batch finishes. Stable source keys make replay safe, while a lease prevents overlapping jobs. Backoff respects rate limits.
4. **How do you preserve workout history?** A completed session contains a snapshot of its planned exercises plus independent actual sets. Later plan edits cannot rewrite that snapshot. Reps and loads in plans remain strings so ranges and percentages survive.
5. **What are the security/scale tradeoffs?** A shared validated-JSON record table simplifies a small application but relies on server schemas for fields. D1 and free provider budgets constrain throughput. OAuth, robust job scheduling and expanded production verification are future work.

## AI-assisted development

AI assisted with implementation, documentation and tests. The developer is responsible for reviewing the code, understanding the trust boundaries, configuring providers and validating live behavior. Tests are evidence about the exercised cases, not proof that every defect is absent. No fabricated historical commits or contributors are used.
