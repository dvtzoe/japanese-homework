# Copilot Instructions

## Commands

```sh
deno task dev          # start server in watch mode
deno task dev:cli      # start CLI in watch mode
deno task dev:server   # start server in watch mode
deno task start        # run CLI once
deno task start:server # run server once
deno task build:cli    # compile CLI to dist/ (override targets via JPHW_BUILD_TARGETS)
deno task fmt          # format
deno task lint         # lint
deno task check        # type-check
deno task test         # run all tests
deno task ci           # fmt --check + lint + check (what CI runs)
```

Run a single test file:
```sh
deno test apps/server/src/cache_test.ts
```

## Architecture

This is a Deno workspace with four packages:

```
packages/types/    @jphw/types   — shared request/response TypeScript interfaces
packages/client/   @jphw/client  — Playwright automation (Google Form scraping + filling)
apps/cli/          @jphw/cli     — interactive CLI (inquirer prompts, credentials at ~/.jphw)
apps/server/       @jphw/server  — HTTP(S) API server wrapping OpenRouter + PostgreSQL cache
```

**Data flow:**
1. CLI (`apps/cli`) calls `client()` from `@jphw/client`
2. Client scrapes the Google Form page using Playwright, collecting `QuestionContext[]`
3. Questions not auto-filled from credentials are batched and POSTed to `POST /answers` on the server
4. Server checks PostgreSQL cache (`PersistentCache`), then calls OpenRouter if needed
5. Answers are applied back to the form via Playwright locators; client auto-fills identity fields (email, name, id, class) locally without hitting the server

**Server caching:** Images are SHA-256 hashed (`image_hash.ts`) before cache lookup to avoid duplicate entries caused by temporary CDN URLs.

**LLM prompting:** For multiple-choice questions, the server instructs the model to return only the 1-based index of the correct choice. `answerIndex` is parsed from the response and stored in the cache alongside the text answer.

## Key Conventions

- **Import paths:** Always use `@jphw/*` JSR aliases (defined in each `deno.json`) — never use relative paths across package boundaries.
- **No default exports** unless a module has a single entry point (e.g. `packages/client/src/index.ts`).
- **Extend `@jphw/types` first** before adding new API fields — both CLI (via client) and server depend on it.
- **Tests go alongside source** with `_test.ts` suffix (e.g. `cache_test.ts` next to `cache.ts`). Use `Deno.test` + `@std/testing/asserts`. Inject `fetch` stubs for network isolation.
- **TypeScript strict mode** is enabled workspace-wide.
- **Commit style:** short imperative subjects, no period (`remove console.debug`, `use realpath`).

## Environment Variables

| Variable | Required by | Notes |
|---|---|---|
| `DATABASE_URL` | server | PostgreSQL connection string, e.g. `user:pass@localhost:5432/jphw` |
| `OPENROUTER_API_KEY` | server | OpenRouter API key |
| `OPENROUTER_MODEL` | server | Defaults to `openrouter/auto` |
| `SERVER_URL` | client/CLI | Defaults to `https://jphw.crabdance.com` |
| `PORT` | server | Defaults to `8000` |
| `TLS_CERT_FILE` + `TLS_KEY_FILE` | server | Both required to enable HTTPS; falls back to HTTP if absent |
| `PLAYWRIGHT_PROFILE_DIR` | client | Overrides default `~/.jphw/{browser}-profile` |

Place secrets in `.env` at the repo root (loaded by `--env-file` in all tasks). Never commit this file.

## Server: PostgreSQL Cache

The `cache_entries` table is created automatically on first run. The schema stores `question` (text), `image_hash` (SHA-256 of image bytes), `choices` (TEXT[]), `answer`, and `answer_index`. Cache lookup matches on question text + image hash + choices; all three are optional but at least one must be provided.

See `apps/server/POSTGRES_SETUP.md` for hosted DB options and SSL configuration.
