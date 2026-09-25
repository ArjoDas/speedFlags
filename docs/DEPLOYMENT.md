# Vercel deployment and operating notes

## Configuration

Use the repository root as the project root and the **FastAPI** framework preset. `pyproject.toml` selects `backend.app:app` and builds the frontend with `npm ci && npm run build`. Do not set the output directory to a static-only Vite deployment: both the Python API and frontend are needed. Clear the original Flask catch-all/build overrides in the Vercel dashboard.

The native FastAPI integration promotes `app.frontend()` and static mounts to the CDN. `[tool.vercel.fastapi.static] cdn = true` is intentional: top-level middleware otherwise disables this promotion. CDN files bypass Python middleware, so `vercel.json` sets their security/cache headers. API validation and game tokens are never handled by a static route. See [Vercel's FastAPI integration](https://vercel.com/docs/frameworks/backend/fastapi).

The country database, source flags and built frontend are explicitly included in the function bundle through `functions["backend/app.py"].includeFiles` in `vercel.json`. Keep the static directories at their original paths: FastAPI mounts them during import and may serve them as a fallback even when the CDN handles normal asset requests. Omitting `frontend/public/flags` caused the first preview's `FUNCTION_INVOCATION_FAILED` error before any API route could run. Original snapshots, test artifacts and environments are excluded from deployment. `requirements.txt` is generated from the locked runtime dependencies; `uv.lock` also locks development tools.

## Web Analytics

The root React app mounts `@vercel/analytics/react` once to collect page views.
Enable Web Analytics for this project in the Vercel dashboard, then deploy the
integration. Installing the package alone does not enable the hosted service.
See [Vercel's setup guide](https://vercel.com/docs/analytics/quickstart).

In production, the SDK loads `/_vercel/insights/script.js` from the site's own
origin, which the existing Content Security Policy permits. Vercel serves the
analytics endpoints; the local FastAPI server does not. After deployment, check
that the script loads and a page-view request succeeds in the browser's Network
panel, then confirm visits appear in the project's Analytics dashboard. Game
actions are not tracked as custom events by this integration.

## Secrets

Set `SPEEDFLAGS_KEYS` on Vercel before preview/production startup. Generate a fresh Fernet key using the installed `cryptography` package. Do not reuse the development key, commit `.env`, or use a `VITE_` prefix (which would expose it in frontend code).

For rotation, provide `new-key,previous-key`. New responses use the first key and old tokens can still be decrypted with the second. Retain the previous key for at least the one-hour context lifetime, then remove it. A deployment with changed dataset/rule versions deliberately asks existing games to restart. Do not accept tokens from an incompatible version.

## Preview checklist before the user publishes

1. Confirm Hobby eligibility and no paid products/add-ons. Current Hobby usage includes 1 million invocations, 4 CPU-hours and 100GB Fast Data Transfer, with other quotas such as provisioned memory also applying. Quota exhaustion can pause service. [Hobby limits](https://vercel.com/docs/plans/hobby)
2. Verify `/`, `/api/health`, a full timed/practice journey, `/api/openapi.json` and direct navigation to a frontend path. Missing `/api/*`, `/assets/*.js` and `/flags/*.svg` must return an error rather than the SPA shell.
3. Check that `/assets/*` and `/flags/*` use the CDN without function invocations. Check personalized `/api/v1/games/*` responses have `Cache-Control: no-store` and public names use short caching.
4. Verify secure headers from `vercel.json`, request IDs for API diagnostics, no secret in built JS, and startup failure for missing/invalid secrets. API documentation is a developer surface and may load its own Swagger assets; gameplay has no third-party requests.
5. Measure cold and warm API latency on the deployed region/network. Local timings do not predict serverless cold starts. Test two tabs, session expiration, deployment/data-version change, asset failure and uncertain-request retries.
6. Observe usage after launch. A normal N-answer game uses about N + 3 API calls (create/start/finish); each tab-resume sync and retry adds a call, while autocomplete and results images do not add API calls. Do not equate request allowance with usable capacity: CPU, memory, transfer, static edge requests and abuse also matter.

The first user-deployed preview exposed a missing static directory in the Python bundle. Redeploy with the explicit file inclusions above, then complete this checklist; hosted cold-start behavior, actual CDN promotion and live quota consumption still need verification.

## Rollback

Deploy the previous known-good code and matching dataset as one unit. Keep stable production keys across deployment unless rotating deliberately. An incompatible dataset causes a clean restart message. Immutable flag filenames change with contents; HTML is revalidated. During rollback, in-flight games may be invalidated and must restart. The existing Flask version remains in Git history, but returning to it restores its known session limitations.

## Competition boundary

The current game token is compressed and authenticated/encrypted, has a fixed maximum lifetime, pins rules/data, and carries bounded casual history. It does not provide globally durable idempotency or prevent replay/branching: retrying an old token can repeat the same transition. Browser sequence guards prevent accidental duplicates in one UI, not adversarial use.

Before rankings, implement authenticated ownership and durable game/attempt/result storage with atomic sequence updates and unique submission IDs. Test retries against separate instances and simultaneous submissions. Choose and benchmark a free-tier data service before introducing it; Cloudflare D1 is a candidate, not an existing dependency. Asset secrecy cannot prevent image recognition, outside help or other cheating. Define latency, release, disconnection and tie policies before claiming competitive fairness.

Cloudflare can host the static frontend, but moving the Python API requires a separately verified runtime and storage design. This configuration is for Vercel.


## Search discovery

Both production domains serve the game. The HTML canonical URL, Open Graph URL,
structured data, and sitemap use `https://speedflags.win/` as the preferred URL;
`https://speedflags.arjodas.com/` remains an alternate host. Submit
`https://speedflags.win/sitemap.xml` in your search engine webmaster accounts after deployment.
The static page includes readable game instructions, and `/robots.txt` allows public
page crawling while excluding API routes. `/llms.txt` provides a concise game reference;
it is an emerging convention, not a guarantee of indexing or AI citations.

The inline JSON-LD has a SHA-256 hash in both the backend and Vercel Content Security
Policies. If its exact text or whitespace changes, update both hashes.

These changes follow Google's [JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
and [AI search guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).
