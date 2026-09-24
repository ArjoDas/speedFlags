# speedFlags modernization and correction plan

Audit date: 24 September 2026. Hard constraint: hosting must remain free on Vercel or Cloudflare.

## Recommended direction

Modernize speedFlags with **FastAPI + React + TypeScript + Vite + Tailwind CSS**, hosted initially on Vercel's free Hobby plan. Keep the backend: FastAPI will select questions, validate answers, enforce timing rules and calculate scores. React handles presentation, input, autocomplete and the displayed timer. Replace Flask and Bootstrap during migration.

Retain a validated country database on the backend and serve reviewed flag assets through the CDN. The browser may cache public country names for autocomplete, but it does not need the complete answer dataset to run scored games. Keep game rules independent of HTTP handlers and UI components so they can be tested directly.

### Selected stack and responsibilities

| Layer | Decision | Purpose |
| --- | --- | --- |
| Backend | FastAPI with typed request/response models | Question selection, answer normalization/validation, timing and scoring; explicit API contracts for React. Vercel supports FastAPI on Python Functions. [FastAPI deployment](https://vercel.com/docs/frameworks/backend/fastapi) |
| Frontend | React + TypeScript + Vite | Reusable setup, game, suggestions and results components, with a reducer for UI transitions. [React guidance](https://react.dev/learn/build-a-react-app-from-scratch) |
| Styling | Tailwind CSS | Replace Bootstrap classes, Sass overrides and Bootstrap JavaScript with shared design tokens and accessible React controls. Tailwind provides styling, so combobox/dropdown behavior still needs implementation. [Tailwind installation](https://tailwindcss.com/docs/installation/using-vite) |
| Country data | Validated SQLite snapshot, read-only in production | Keep the existing database approach while correcting mappings and separating SVG files from queryable metadata. Refresh through a reviewed import/build process. |
| Hosting | Vercel CDN for frontend/assets; Vercel Functions for FastAPI | Keep the existing provider and measure function usage against free allowances. Cloudflare remains an alternative requiring a separate backend deployment evaluation. |

Next.js is not selected: it builds on React, but Vite is sufficient for this frontend and FastAPI owns the API. A future need for a larger content site can prompt reassessment without changing the Python backend.

Keeping FastAPI now establishes a place for competition rules. It does not by itself make scores cheat-proof: durable attempt records, authenticated participants, replay protection and an explicit fairness policy are additional competition requirements. The initial release remains casual play; section 3 defines this boundary. The core migration is implemented on the `modernise` branch; see [implementation status](docs/IMPLEMENTATION.md) for completed work and deferred items.

This document records the original audit and implementation plan. The original database remains preserved; the generated runtime dataset and application have since been modernized. Findings below come from repository inspection and read-only SQLite/XML/hash checks. The deployed site, production logs, real-device behavior, and visual correctness of every flag have not been tested. Code-path findings are distinguished from production hypotheses; this audit cannot establish that every possible error has been found.

## 1. Findings and priorities

P0: correctness/security failures to address first. P1: release requirements. P2: later improvements.

| Priority | Finding and evidence | Proposed correction |
| --- | --- | --- |
| P0 | `app.py` keeps the current answer in a filesystem session under `/tmp` on Vercel and generates a random secret if the environment variable is absent. State is tied to an instance; independently initialized processes can also have different signing keys. | Replace filesystem sessions with explicit game/question context in FastAPI. Use a stable configured secret and a design that does not depend on shared temporary files. Reproduce missing-session behavior before attributing the user's production symptom to it. |
| P0 | `checkAnswer()` parses error responses as successful data. A missing session produces `{error: ...}`, but the Enter handler reads `answer` and `correctAnswer` anyway (`static/js/newgame.js:471–482,650–669`). | Validate status and response shape before changing score/history. Display a recoverable error; never record a transport/session failure as a wrong answer. |
| P0 | Repeated Enter presses can overlap answer checks and next-flag requests. The server stores only one current answer per session, also shared across tabs. Input is read again after an `await`, and results can arrive after time expires. | Capture immutable question ID and answer at submission; allow one transition per question; reject late/stale completions. Keep tab-local game state. |
| P0 | Results interpolate `round.userAnswer` directly into `innerHTML` (`newgame.js:65–77`). Keydown filtering does not prevent pasted HTML. | Render user/data text with `textContent` or escaped framework bindings. Add a pasted-markup regression test. Avoid inserting downloaded SVG markup directly into the document. |
| P1 | `/fetch_specific_cca2` indexes `specific_country[0]` even when there are no matches. JSON endpoints assume an object and expected string types. | If retained, validate media type, JSON shape, field type/length and missing results; return deliberate 400/404 errors. Remove the lookup entirely when history stores stable IDs. |
| P1 | Flag fetches do not check HTTP status/schema; failures mostly go to the console. Early Enter can access an uninitialized `currentCountry.common`. | Explicit loading/error/ready states, disabled submission until ready, bounded retry, and visible recovery. |
| P1 | Autocomplete makes a request on every input event, concatenates an unencoded query, and lets old responses overwrite newer text (`newgame.js:406–430`). Enter automatically substitutes the first highlighted suggestion. | Search the small manifest locally; rank exact matches before prefixes/substrings. Highlight the first suggestion by default and submit it with one Enter, as requested in the UI review; support arrows, Escape and click/touch. If temporarily remote, debounce, use `URLSearchParams`, cancel requests, and discard stale results. |
| P1 | Instructions say the timer starts on the first try; code requires a correct answer to the revealed starter flag. The timer then begins before the next flag has loaded. | Keep a revealed, unscored warm-up flag. Validate its answer on the server before starting the timer; show Ready until then and document scoring rules. |
| P1 | Sampling uses `ORDER BY RANDOM()` independently for each question; immediate repeats are possible. Bonus time can push the progress bar above 100%. | Shuffle an eligible question deck, avoid repeats until exhaustion, and define/clamp progress presentation. |
| P1 | Input filtering accepts only ASCII letters, spaces and hyphens; it blocks punctuation in names such as Cocos (Keeling) Islands. Backend matching only lowercases. | Allow normal text/IME input; normalize whitespace, case, diacritics and punctuation consistently and maintain explicit aliases. Do not silently accept ambiguous aliases. |
| P1 | Results request one country lookup per row and then load external FlagCDN JPGs (`newgame.js:79–99`), independent of the SVG actually asked. | Store question/asset IDs in history and reuse local assets. Eliminate result-page request fan-out and mismatched flag versions. |
| P1 | The UI fixes flags at 300px tall and clips overflow; panels use large minimum heights and absolute positioning. Suggestions lack tap handlers and the input lacks an explicit label. | Responsive flag sizing and layout, touch submission, accessible combobox, visible focus, and mobile results cards. |
| P1 | Theme selection styling targets nonexistent `#bd-theme` markup and returns early. Storage access is unguarded. | Align theme controls and script, expose selected state and labels, validate stored settings, and fall back when storage is unavailable. |
| P1 | Git tracks 14,368 `.venv` files, 501 `node_modules` files, and `.DS_Store`. Ignore rules omit `.venv/` and `node_modules/`. | Stop tracking generated dependencies without deleting local environments; add ignore rules and clean-install checks. Do not rewrite repository history as routine cleanup. |
| P1 | `package.json` has only Bootstrap and no build/test scripts or Sass compiler. Python requirements contain unrelated/old pins, commented inventories, and a second legacy requirements file. Import scripts require undeclared `unidecode`. | Create a reproducible build and lockfile; remove unused runtime packages, declare data-tool dependencies separately, audit dependencies and update compatible versions. Age alone is not proof of a vulnerability. |
| P2 | `newgame.js` mixes state, network, templates and DOM mutation; selectors and values are duplicated. SCSS imports icons twice; template markup includes an unmatched closing `li` and nested interactive restart elements. README overstates guarantees and omits setup. | Split responsibilities, validate HTML, simplify styles/dead code, and replace README claims with actual behavior and reproducible instructions. |

## 2. Database investigation and repair strategy

### What the checked-in database actually contains

Read-only inspection of `speedflags.db` found:

- SQLite `PRAGMA integrity_check`: `ok`.
- One `flags` table, 250 rows; `cca2` is the primary key. Other columns are `common`, `official`, `svg_url`, and `svg_code`, all declared `NOT NULL`.
- No null, empty, or exact `undefined`/`null`/`none` sentinel values in those columns.
- All 250 `svg_code` values parse as XML with an SVG root. This does not prove that all render correctly or depict the correct current flag.
- No duplicate common names (case-insensitive) or source URLs. Three groups have byte-identical SVG content, identified by SHA-256:

| Codes | Names in the database |
| --- | --- |
| `FR`, `MF` | France; Saint Martin |
| `NO`, `SJ`, `BV` | Norway; Svalbard and Jan Mayen; Bouvet Island |
| `US`, `UM` | United States; United States Minor Outlying Islands |

These groups contain seven entity rows and four repeated asset copies. They are not duplicate primary keys. Distinct geographic entities can legitimately use the same flag, so do not delete rows or assign replacement images solely because their SVG hashes match. Review each mapping and document its intended treatment. Exact hashes also miss visually identical flags encoded differently.

The database is 4,182,016 bytes; SVG text totals 3,599,249 bytes. The largest asset is El Salvador at 248,937 characters. Asset optimization is worth measuring, with visual comparison to protect detailed emblems.

Audited database SHA-256: `2bf239b7ab787e0ff3ab63c862e0d8630bce047fae684247dc1df5d150b5adcb`.

### Trace the reported “undefined” symptom

The local data does not establish database corruption as the cause. Two code paths deserve targeted reproduction:

1. A missing session returns HTTP 400 without `correctAnswer`. The frontend records the absent field, then prints `undefined` in results and sends a lookup body with the missing country omitted. The lookup can then fail too.
2. Flag responses are used without checking for a valid `svg` field. An unexpected JSON response can therefore feed `undefined` into the rendering path.

Filesystem sessions, random fallback secrets, concurrent requests and outdated deployed assets are hypotheses to test against the actual failing request. Capture route, status, response shape, question ID and timing in a preview environment; compare the deployed dataset/version with the hash above. Do not log raw session cookies or secrets. Test early submission, session loss, two tabs, repeated Enter, slow responses and expiry during an answer request.

### Build a reproducible data pipeline

1. Preserve the original DB and export a baseline manifest/assets before changing data. Keep a machine-readable report of every old-to-new ID and exclusion.
2. Replace `temp_files/temp3.py` and `temp4.py` with one documented importer. Remove the hardcoded developer path, incompatible `CREATE TABLE IF NOT EXISTS` schemas, silent worker failures, and writes of empty strings after download errors. Consume every future's result.
3. Fetch only in an explicit refresh command, with timeouts, bounded retries, HTTP/content checks and source attribution. Builds must use reviewed committed data, not require a live third-party API.
4. Validate unique IDs, required names, safe asset paths, SVG roots/viewBoxes, finite positive dimensions, referenced files, and allowed geographic classifications. Reject scripts, event handlers, external resources and other disallowed SVG constructs; XML parsing alone is insufficient.
5. Write updates to staging, compare with the baseline and publish atomically only after validation. Failed downloads must preserve the previous valid asset. Record source URL, retrieval date, license/attribution, checksum and dataset version.
6. Produce an exact-hash duplicate report plus rendered contact sheets. Review potential visual duplicates and outdated/incorrect mappings against reliable sources; record explicit exceptions. Verify licenses before redistributing assets.
7. Produce a validated read-only SQLite snapshot for FastAPI, an internal audit manifest, a public country-name search index, and separate optimized SVG files. Render via `<img>` with `object-fit: contain`; preserve original proportions and nonrectangular shapes. Keep original assets available for comparison.

Proposed model:

| Entity | Fields |
| --- | --- |
| Country/territory | Stable ID (`cca2` where applicable), display name, official name, aliases, region, entity classification, enabled modes |
| Flag asset | Asset ID, local path, hash, dimensions, source, attribution, reviewed date/version |
| Question | Question ID, asset ID, accepted entity IDs, scope, optional disambiguating prompt |
| Attempt | Question ID, submitted text, resolved entity ID if any, result, elapsed time, dataset version |

Keep geographic identity separate from asset identity. For the initial timed deck, select one reviewed question per equivalent flag group and accept all declared equivalent answers for a flag-only prompt. Optional territory mode may use explicit geographic context to distinguish shared flags. Show all accepted alternatives in the explanation. Do not merge merely similar designs automatically, and do not label all 250 entries as sovereign countries. Scope and naming should be transparent and versioned.

## 3. Backend, game engine and application structure

Proposed layout:

```text
backend/
  app/           # FastAPI entrypoint, routes, request/response models
  game/          # question selection, answer validation, timing, scoring
  repositories/  # country reader; future durable game/attempt storage
  tests/         # rules, API contracts and malformed/replayed request cases
frontend/
  src/
    api/         # typed API client, error handling and cancellation
    game/        # UI state transitions and timer display
    ui/          # React setup, game board, suggestions, results, theme
    storage/     # versioned preferences and local personal-best cache
    styles/      # Tailwind entry point and design tokens
  public/flags/  # validated assets served by CDN
data/            # reviewed database, manifests, overrides and attribution
scripts/         # import, validate, export and optimize
tests/           # end-to-end browser journeys
```

### API and gameplay flow

- `GET /api/v1/countries`: return cacheable public names/IDs for local autocomplete, without current-question answers.
- `POST /api/v1/games`: validate allowed settings and create a game context with a dataset version and initial question. Model preparation and activation separately so initial loading is handled deliberately.
- `POST /api/v1/games/{id}/start`: validate the revealed warm-up answer, activate a prepared casual game, and return the first scored question and server time/deadline. A future competitive start must use a server-controlled release policy; do not let players study a question indefinitely before its clock begins.
- `POST /api/v1/games/{id}/answers`: receive game context, question ID, sequence, submission ID and answer/skip. Validate the question and deadline, calculate the result and return updated score/context plus the next question in one response.
- `POST /api/v1/games/{id}/sync`: resynchronize server time/state when returning to a tab, without restarting the clock or advancing a question.
- `POST /api/v1/games/{id}/finish`: validate final context and return the server-calculated summary. Never accept a client-declared score as authoritative.

Use Pydantic request/response validation, bounded input lengths, stable error codes and generated TypeScript types from OpenAPI. Keep game traffic under `/api`; route assets directly to the CDN. Use explicit per-game context rather than one cookie field for the current answer, so tabs do not overwrite each other's questions. For cookie-based credentials, address CSRF and cookie attributes; keep origins restricted and secrets exclusively on the server.

### Storage now and before competitions

Country data is a read-only SQLite artifact bundled with FastAPI, opened via a path relative to the application package. It needs no persistent writes during gameplay. Never store mutable sessions or competition results in the deployed SQLite file, `/tmp`, or process memory and assume another instance will see them.

For initial casual play, a bounded, expiring, authenticated game token can carry server-issued game state between requests, avoiding a hosted writable database. Pin the dataset version and rule settings; protect the seed/question state using authenticated encryption if it must remain opaque. A signature alone does not hide token contents. Keep the server-generated state compact, validate every transition, and load a stable versioned key from environment configuration with no random production fallback. Test key rotation/expiry and old-dataset behavior across deployments.

This stateless approach cannot globally consume a token, prevent branching/replay, or provide durable idempotency. The UI must ignore duplicate responses, but casual scores must not be treated as competition results. If durable game storage is introduced earlier, replace this mechanism through the repository interface.

Before enabling competitions, require:

- Shared durable storage for games, issued questions, attempts and results, with migrations, retention, backups and recovery.
- Atomic conditional updates or transactions enforcing one accepted attempt per question/sequence; unique submission IDs with persisted idempotent responses. Concurrent retries must return the original outcome without rescoring.
- Authenticated participant ownership, server-controlled question release/deadlines, finalized immutable results and consistent rules for disconnects, skips, retries and ties.
- Rate limits and abuse controls backed by shared enforcement, plus audit records. Keep future questions/answers out of responses and avoid answer-revealing filenames/metadata; opaque URLs still cannot prevent image recognition or outside assistance.
- A documented latency/fairness policy and a zero-cost capacity check before launch. A free-tier database such as Cloudflare D1 is a candidate, not a selected integration: verify FastAPI connectivity, atomic update semantics, latency and actual quotas first. Free D1 usage is limited. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)

### State, timing and error behavior

- Use React reducers with explicit loading, ready, submitting, playing, results and recoverable-error states. Clean up timers/listeners and verify Strict Mode cannot duplicate submissions. Avoid direct DOM mutation and `dangerouslySetInnerHTML`.
- Capture input/question context before each request; disable concurrent submission and ignore stale responses after restart. UI sequence guards complement backend validation.
- The server checks its deadline and applies bonus time. The browser interpolates a display using `performance.now()` and server time/deadline, resynchronizing on responses and tab return. Browser timestamps do not authorize points or time extensions.
- Timed play continues during hidden tabs and request delays; make that rule explicit. Network failures never become wrong answers. On an uncertain submission, retry the same submission ID; casual stateless retries have the limitations above, while competitions require durable idempotency. Never silently fall back to local scoring.
- Preload assets in casual play where useful and verify the current flag is decoded before interaction. Loading failures show recovery and mark an interrupted game as noncompetitive; client loading reports must never grant extra time in a competition. Bound retries and define expiry while disconnected.
- Keep duration/bonus settings allowlisted on the server. Key local personal bests by mode, scope, duration, bonus and dataset version. Cached local results are not leaderboard evidence.
- Centralize answer rules in Python. Local search normalization should use shared test fixtures for compatible suggestions, while the API decides correctness. Handle aliases, punctuation, Unicode and ambiguity explicitly.
- Shuffle the question deck on the backend without replacement; define empty/small deck behavior. Bind the deck to the game and dataset version. Deterministic seeds help tests, but competitive seeds/future order must not be exposed.
- Store preferences and a bounded personal-best/history cache in browser storage, with schema versioning and corruption recovery. Store immutable question/asset IDs in history and reuse assets in results without per-row lookup calls.

## 4. UI and experience redesign

Build a complete mobile-first loop, rather than adding more controls to the existing fixed panels.

| Screen | Proposed behavior |
| --- | --- |
| Setup | Clear game title and concise rules; Timed/Practice selection; duration, bonus and geographic scope; visible Start button; settings remembered locally. |
| Play | Large undistorted flag, timer/score/attempts, labeled answer field, useful suggestions, touch-friendly Submit and Skip buttons, compact feedback. Keep the keyboard and flag usable together on mobile. |
| Results | Score, accuracy with defined denominator, answered/skipped counts, personal best for the same settings, and a review of each flag with accepted answers. Replay same settings and Practice missed flags actions. |
| Learn (later) | Searchable flag gallery, region filters, explanations of shared flags, and local weak-flag practice. |

Define Skip as advancing with no point and a recorded skipped attempt; distinguish it from incorrect and unanswered-at-expiry states. Make the results formulas and bonus rules visible in help text.

Use a restrained color system, consistent spacing/type, comfortable touch targets, and a single clear primary action per state. Replace fixed-width SVG calculations and absolute-positioned controls with flexible grid/flex layouts. Use result cards on narrow screens and a table on wider screens. Include visible empty, loading and retry states.

Accessibility release requirements:

- Semantic form submission, visible labels and focus, keyboard-complete navigation, and a properly labeled combobox/listbox with active-option state, Escape and Enter behavior.
- Visible caret; preserve editing shortcuts, paste and IME composition. Do not submit while composing text.
- Status announcements for feedback and game completion; avoid announcing the timer every 100ms. Provide text as well as color for correctness and respect reduced motion.
- Flag quiz alternative text must not reveal the answer; results should name the country. Offer a separate accessible learning experience where visual flag identification itself is unsuitable.
- Correct selected-state labels for light/dark/system themes, sufficient contrast, and usable layout at 200% zoom and 320px width. Test with a screen reader and mobile soft keyboard.

## 5. Free hosting and deployment

Documentation checked on the audit date; recheck limits before release.

| Option | Fit and constraints |
| --- | --- |
| Vercel Hobby, React assets + FastAPI | Selected initial deployment. Current allowances include 100GB Fast Data Transfer, 1 million Edge Requests, 1 million Function Invocations and 4 CPU-hours. Usage also depends on memory and other limits; exceeding allowances may pause service. Hobby is for personal, noncommercial use. Review eligibility if competitions introduce fees or commercial use. [Vercel Hobby](https://vercel.com/docs/plans/hobby) |
| Cloudflare | A static React frontend can use Pages, but that alone does not host the FastAPI backend. Treat a full backend move as a separate runtime, storage and deployment validation task, not a drop-in upload. Pure Pages static requests are free and unlimited; function quotas are separate. [Pages routing](https://developers.cloudflare.com/pages/functions/routing/) |

Deployment plan:

1. Pin supported Node/Python versions and lock both dependency sets. Add frontend build/types/lint/tests, backend lint/tests, and data-validation commands. Use separate runtime and data-tool dependencies.
2. Build the React frontend into `dist/` and deploy FastAPI as a Python Function. Configure and test `/api/*` versus static/SPA routing; remove the legacy Flask catch-all. Verify deep links, missing assets and JSON API errors independently. [FastAPI deployment](https://vercel.com/docs/frameworks/backend/fastapi)
3. Bundle the validated country database read-only with the API; use versioned flag assets and cached public country names. Mark personalized game responses non-cacheable. Do not expose secrets or the internal answer/deck manifest in frontend builds.
4. Self-host flags, icons and styling. Keep live third-party data APIs out of the gameplay path. Serve SVGs through the CDN rather than returning markup through Python on every question.
5. Measure cold/warm API latency, function invocations, CPU/memory and transferred bytes per game. Target one answer request including the next question, local autocomplete, and no per-row result requests. With create/start/finish, N attempts need roughly N + 3 API calls before retries; forecast traffic and leave headroom for abuse and other quotas.
6. Inspect compressed frontend size and network traces. Initial targets: app JS under 150KB gzip and public name metadata under 100KB gzip; measure flag transfer separately. Add request/sequence IDs for debugging without logging credentials, tokens or unnecessary raw input.
7. Confirm stable server secrets, serverless restart behavior, security headers and free-plan settings in preview before release. Keep a tested code/data rollback pair; do not silently change scoring rules for an active game.
8. Stay on free plans and provided subdomains if needed; avoid trials/paid add-ons and paid data services. Review usage periodically. If quotas or eligibility become unsuitable, evaluate a fully supported free Cloudflare deployment before migration. A backend adds capacity limits; no design promises unlimited free competitions.

## 6. Delivery sequence and completion gates

### Phase A — Baseline and urgent stabilization (P0)

- Preserve/hash the DB; capture a reproducible failing-game scenario and the data audit.
- Fix unsafe result rendering, response validation, early/repeated submission and expiry races if the existing site will remain live during the migration.
- If retaining Flask for this phase, remove dependence on temporary session state: a signed, expiring question token with a stable secret is one possible bridge. Bind requests to a question ID; do not mistake stateless tokens for replay-proof competitive scoring.
- Validate retained API inputs, use deliberate errors, and address CSRF for any cookie-backed state-changing routes. `CSRFProtect` is currently imported but never enabled. Remove obsolete endpoints/dependencies after migration.

Gate: missing session, bad response, pasted markup, rapid Enter, early Enter and delayed answer responses cannot corrupt score/history or crash the UI.

### Phase B — Data foundation and repository cleanup (P1)

- Implement importer/exporter/validator, reviewed manifest, alias rules, shared-flag policy and visual contact sheet.
- Untrack generated environments/packages, fix ignores, establish the clean build, and document setup/data refresh.
- Remove unused imports, legacy requirement inventories and abandoned scripts once their useful behavior is replaced. Add project and asset licensing/attribution documentation.

Gate: a fresh checkout builds without the author's environment or network data downloads; every playable question has a valid reviewed asset and unambiguous acceptance policy. Failed refreshes preserve the last valid dataset.

### Phase C — FastAPI migration and React UI (P1)

- Implement FastAPI routes, server game rules, read-only country repository and validated game context. Generate frontend API types and implement local name search, server answer checking, stable-ID history, guarded storage and loading/recovery.
- Port Flask behavior through regression tests, switch the frontend to the versioned API, then remove Flask, Flask-Session and obsolete routes/dependencies. Keep the Setup → Play → Results loop intact.
- Build React components with Tailwind for responsive layouts, light/dark/system themes, keyboard/touch controls and basic Practice mode. Replace Bootstrap dropdown/collapse behavior with accessible React controls; remove Bootstrap CSS, JavaScript, icon CDN imports and Sass overrides after the new screens are complete.

Gate: core journeys work through FastAPI across independent function instances, without filesystem session state. Invalid or delayed responses cannot corrupt results, and API outages offer recovery without accepting local scores. Mobile layouts preserve full flags and usable controls.

### Phase D — Verification and release (P1)

- API tests: malformed payloads, invalid/expired/tampered game tokens, mismatched game/question IDs, out-of-order submissions, server deadline enforcement, key/dataset changes and independent instances. For future durable storage, add transaction/replay/idempotency and participant-ownership tests before enabling competitions.
- Unit tests: normalization/alias collisions, shared flags, deck exhaustion, one score per question, skips, bonus time, exact deadline boundaries, restart and settings migration.
- Data tests: invalid/empty SVG, unsafe SVG, missing files, duplicate IDs, unreviewed hash groups, failed downloads, partial updates and deterministic exports.
- Browser tests: start/answer/skip/finish/replay; zero/one/many suggestions; mouse/touch/keyboard; slow/missing assets; rapid input; visibility changes; two tabs; disabled/corrupt storage; pasted HTML and literal `undefined` never reaching visible output.
- Test phone, tablet and desktop layouts; Chromium, Firefox and WebKit; keyboard-only and screen-reader smoke checks; automated accessibility checks plus manual review of quiz semantics.
- CI on changes: clean installs for Python/Node, data validation, types/lint, backend unit/API tests, frontend tests, production build and core browser smoke tests. Audit actual dependency advisories; do not blindly apply breaking upgrades.
- Deploy a preview, verify hosting settings, headers, direct navigation, caching and free-plan usage, then promote the tested build. Preserve a known-good build/commit and data version for rollback; avoid incompatible destructive storage migrations.

Gate: no known P0 issues, no undefined/missing assets in the full playable deck, validated server-side scoring, no temporary-file session dependency, accessible core flow, successful frontend/backend builds and measured free-plan capacity.

### Phase E — Optional improvements (P2)

Add regional challenges, multiple choice, local weak-flag practice, richer statistics and a deterministic daily challenge. Add installable/offline support only after designing cache versioning and update recovery. Prepare competitions through the durable-storage, identity, replay-protection and fairness gates in section 3. Implement accounts and public leaderboards only after that work and a validated zero-cost operating model; offline practice results must remain separate.

## 7. Defaults for implementation

Proceed with FastAPI on Vercel, a read-only validated country database, React/TypeScript/Vite with Tailwind CSS served through the CDN, server-validated casual scores, a revealed warm-up that starts timing on correct entry, existing time/bonus choices, a reviewed flag-question deck, and shared-flag acceptance groups. Keep browser storage for preferences/personal-best caches and defer trusted competition results until durable shared storage and replay controls are in place. Territories and disputed/name-sensitive entries need documented scope decisions during data review. These defaults keep the first modernization release focused on reliability, fairness and usability without recurring infrastructure costs.
