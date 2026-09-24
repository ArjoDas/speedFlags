# speedFlags

A flag game with timed rounds, relaxed practice, shared-flag answers, and a review of every attempt. Built with **FastAPI, React, TypeScript, Vite and Tailwind CSS**.

The server owns question selection, answer validation, deadlines and scoring. The browser handles the interface and local preferences/personal bests. The reviewed collection contains 250 countries and territories represented by 245 distinct playable flags, including a curated starter collection of 50.

## Run locally

Requirements: Node 22.12+ (22 LTS recommended), [uv](https://docs.astral.sh/uv/), and Python 3.12. `uv` can install the pinned Python version. The old project environment is not used.

```sh
UV_PROJECT_ENVIRONMENT=.venv-modernise uv sync --locked
npm ci
.venv-modernise/bin/python scripts/dev-key.py
npm run build
.venv-modernise/bin/uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Open **http://127.0.0.1:8000**. `.env` is generated locally, is ignored by Git, and is not overwritten if it already exists. The app intentionally fails startup if `SPEEDFLAGS_KEYS` is absent or invalid. On Windows, use the environment's `Scripts` executables instead of `bin`.

For frontend hot reload, keep FastAPI running and run `npm run dev` in another terminal. Open the Vite URL; `/api` requests are proxied to port 8000 and flags are served locally by Vite.

## Verify changes

```sh
python3 scripts/data.py --check
npm run lint
npm run format:check
npm test
npm run build
.venv-modernise/bin/ruff check backend scripts
.venv-modernise/bin/pytest -q
npx playwright install chromium firefox webkit
npm run test:e2e
```

The browser suite starts the backend if necessary and tests the built app. Run the build first. CI performs the same checks, including generated API contracts. Browser reports are written to ignored `playwright-report/` and `test-results/` directories.

After changing API models/routes:

```sh
.venv-modernise/bin/python -m scripts.openapi
npm run api:types
```

## How games work

- **Timed:** 30, 45, 60 or 120 seconds, with optional +5 seconds for each correct answer. The server starts the clock after the first flag has loaded. Time continues during tab changes and network delays; resuming a tab resynchronizes with the server.
- **Practice:** no score timer. Finish whenever you like, or complete the selected deck. All rounds have a 15-minute lifetime; prepared contexts expire after one hour.
- **Answers:** case, punctuation, accents and whitespace are normalized. Common/official names and reviewed aliases are accepted. Suggestions do not silently replace a typed answer. Use arrows then Enter to select a suggestion, and Enter again to submit; touch/click selection also works.
- **Shared flags:** any accepted country/territory name earns the point. Equivalent assets appear once per deck. Similar designs with different proportions or colors remain distinct.
- **Skip:** records an attempt without a point. Accuracy is correct / attempts, including skips. An unanswered flag at expiry is not counted.
- **Results:** include the exact flag used, accepted names and your answer. Replay or practice missed flags. Early-ended rounds do not update timed personal bests. Personal bests are separated by settings and dataset version.
- **Storage:** settings/theme and personal bests stay on this device. No account or cross-device synchronization. Storage failure does not prevent playing. Reset saved progress from the footer.

A failed API request is never scored as an incorrect answer. Retry reuses the captured question and submission ID. The client blocks overlapping submissions and discards results from an abandoned game. Missing/expired contexts produce a visible recovery path rather than `undefined` flags or names.

## Data and maintenance

The original `speedflags.db` is preserved unchanged. FastAPI uses `data/generated/countries.db` read-only; SVGs are separate local assets with content-derived filenames. See [data provenance and refresh instructions](docs/DATA.md), the generated [flag contact sheet](docs/flags.html), and [the modernization plan](PLAN.md).

```sh
python3 scripts/data.py          # rebuild from the reviewed, committed snapshot
python3 scripts/data.py --check  # validate without network access
python3 scripts/data.py --refresh # download a new snapshot into staging for review
```

A refresh aborts if downloading/validation fails or exact duplicate groups change. Review all generated changes together before committing. Data refresh is never part of normal production requests or deployment builds.

## Hosting and competitions

Deployment targets Vercel Hobby: FastAPI as a Python Function and the React build/flags on its CDN. Set a **separate production `SPEEDFLAGS_KEYS`**, use the repository root, and remove old dashboard build/output overrides. See [deployment and rollback](docs/DEPLOYMENT.md).

This release is **casual play**, not a secure competition platform. Encrypted, expiring context removes dependence on ephemeral server session files, but a stateless token cannot globally prevent replay/branching or persist results. Public rankings require shared durable storage, participant identity, atomic attempt consumption/idempotency, rate controls and a fairness policy. Those remain deferred; the backend has a separate data repository and game service to support that work.

No push or deployment is performed by the modernization work. Free-tier availability and quotas must be checked before hosting or enabling competitions.

## Origins and attribution

Originally built as a Flask/vanilla-JavaScript project. [Original video demo](https://youtu.be/p_8dHJ_5BW4).

Flag images come from FlagCDN/Flagpedia; see [data attribution](docs/DATA.md). Third-party packages retain their respective licenses. No new license for the original application is asserted here.
