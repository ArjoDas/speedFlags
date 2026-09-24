# Modernization status

Implemented on `modernise`, 24 September 2026. No push, remote configuration or deployment was performed.

## Completed

- Removed tracked virtual environments, packages and OS files while preserving local dependencies; added reproducible Node/Python lockfiles and clean-install instructions.
- Preserved the original database byte-for-byte. Refreshed and validated the 250 flag entries; separated SVGs from the runtime database and normalized missing viewBoxes.
- Grouped the three byte-identical flag families plus visually equivalent Australia / Heard Island and McDonald Islands. The playable full deck contains 245 questions; shared names are accepted fairly. Asset source, retrieval date, hashes and explicit equivalence decisions are recorded.
- Replaced Flask/filesystem sessions with FastAPI contracts and a separate game service. The server controls selection, validation, deadlines and scoring. Encrypted expiring contexts work across independent instances and support key rotation.
- Replaced vanilla DOM mutation/Bootstrap with React, TypeScript, Vite and Tailwind. Added timed/practice modes, scope/duration/bonus controls, keyboard/touch suggestions, skip, recovery, results, replay, missed-flag practice, themes and guarded personal-best storage.
- Added explicit submission sequencing, captured answers, aborted stale requests, IME protection, server timer resynchronization and safe React text rendering. Missing sessions/invalid responses no longer enter scoring history as undefined data.
- Configured Vercel's native FastAPI deployment and CDN promotion, security/cache headers, API/asset routing, environment configuration and rollback documentation. Removed retired Flask templates, Bootstrap styles, legacy scripts and unused requirements.
- Added CI and local verification commands. Generated TypeScript API contracts are checked against OpenAPI.

## Verification performed

- **33 backend/data tests passed**, covering data integrity/export, unsafe SVG rejection, failed refresh preservation, equivalence rules, normalization, token expiry/tampering, version/key changes, independent instances, sequencing, scoring, deadlines, sync and missing asset/API routes.
- **3 frontend unit tests passed**, covering name search/normalization and unavailable browser storage.
- **50 Playwright checks passed** across Chromium, Firefox, WebKit and emulated iPhone. Six duplicate runs were intentionally skipped: screenshots/contact sheets and the real 30-second expiry test run once in Chromium; other journeys run in all four projects.
- Browser journeys cover correct/incorrect/skipped answers, literal pasted HTML, replay/missed practice, keyboard/touch selection, rapid Enter, retry after network failure, malformed responses, expired sessions, asset failures, cancellation, IME composition, storage denial, theme changes, 320px layouts and real timer expiry.
- All 250 entries decoded successfully in each engine. Reviewed all entries in five contact sheets and inspected desktop/mobile game screenshots. Automated axe checks reported no violations in setup, play and results.
- Clean source copy installed dependencies from lockfiles, rebuilt the production app, and passed TypeScript, lint, formatting, unit and backend/data checks. No dependence on the author's tracked environment remains.
- JavaScript is approximately **77KB gzip**; country-name metadata is approximately **3.8KB gzip**. A local in-process sample of 50 answer requests measured approximately **0.81ms median / 1.56ms maximum**, with a maximum JSON response of **6.1KB** and a context token of **5.4KB** after 50 skips. These are local measurements, not Vercel cold-start or network results.
- npm dependency audit and the locked Python runtime audit reported **no known vulnerabilities** at verification time. The Python test client emits an upstream HTTPX deprecation warning; tests pass.

## Deliberate boundaries and remaining release checks

- No live deployment was made, as requested. Hosted cold starts, actual CDN promotion, production secrets and real quota consumption must be checked when the user connects Vercel. See [deployment instructions](DEPLOYMENT.md).
- Mobile testing used emulation. Physical soft keyboards and an actual screen reader have not been exercised; keyboard paths, semantics, layouts and automated accessibility checks were verified. No claim of complete accessibility certification is made.
- The data follows the reviewed provider snapshot, including regional/historical variants. Visual inspection does not certify political recognition or every official designation; the scope policy is documented in [DATA.md](DATA.md).
- The initial game uses stateless casual scoring. It cannot globally prevent token replay/branching or provide durable idempotency. Accounts, competitions, rankings and synchronized progress require the additional storage/identity/fairness work in PLAN.md.
- Optional later features remain deferred: regional challenges, multiple choice, a learning gallery, daily challenges and installable/offline support. No paid service was introduced.

Temporary fixes to the old Flask UI were superseded by regression-tested replacements on this branch; the original application remains in Git history.
