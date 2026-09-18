# Repository Guide

## Runtime and Commands

- This is one CommonJS npm package; there are no workspaces or nested packages.
- Use Node.js `>=20.18.1`: the locked `cheerio@1.1.2` dependency requires it.
- Install with `npm ci`, then run `npx playwright install chromium`.
- `npm start` runs `node scraper.js` with hard-coded defaults `php` and `Brasil`; it accepts no CLI arguments and opens a visible browser.
- `npm run start:api` runs `node api.js` on `PORT` (default `3000`). The real routes are `POST /api/scrape` and `GET /api/jobs`; the README's `POST /scrape` example is stale.
- `npm test` intentionally exits with `Error: no test specified`; there is no test runner, lint, format, build, typecheck, or codegen command. Use `node --check <changed-file.js>` for syntax-only verification.

## Configuration and Live Runs

- Both entrypoints require `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD` in the environment or root `.env`. `src/core/config.js` calls `process.exit(1)` at import time when either is missing, so even API startup and `GET /api/jobs` require credentials.
- Optional variables are `MAX_PAGES=3`, `JOBS_PER_PAGE=25`, `TIME_PERIOD=any`, and `PORT=3000`. Supported periods are `24h`, `7d`, `30d`, and `any`.
- End-to-end checks require credentials, network access, a Playwright browser, and interaction with live LinkedIn markup; CAPTCHA or 2FA may intervene. Do not run them or claim scraper correctness without making that external interaction explicit.
- Never commit `.env`, session cookies, scraped job data, or `login-error.png`; the screenshot is generated on login failure and is not gitignored.

## Code Boundaries

- `scraper.js` is the orchestration entrypoint and exports `runScraper(keywords, location)` for the API. Direct execution uses fixed defaults.
- Keep LinkedIn login, selectors, and page extraction in `src/scraper/linkedin.js`; generic URL, persistence, and session logic belongs in `src/services/`.
- `api.js -> src/routes/jobRoutes.js -> src/controllers/jobController.js -> scraper.js` is the HTTP execution path. `POST /api/scrape` returns `202` immediately and starts untracked work in the background.
- `src/core/browser.js` owns one shared Playwright browser. Each scraper execution owns and closes its context and pages.

## Known Traps

- Storage paths currently disagree: writers and cookies use `src/storage/`, deduplication reads root `vagas.json`, and `GET /api/jobs` reads `storage/vagas.json`. Only root `storage/` exists. Treat path changes as a coordinated fix across all three consumers.
- Pagination drops the requested location: `parseSearchUrl()` and `generateSearchUrl()` do not preserve the `location` query parameter.
- Detail scraping is deliberately capped at the first five unseen jobs in `scraper.js`, regardless of `MAX_PAGES` or result count.
- Selectors target live LinkedIn DOM and are brittle; update them in `src/scraper/linkedin.js`, not in orchestration or route code.
