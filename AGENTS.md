# Repository Guidelines

## Project Structure & Module Organization
This workspace is driven by Deno's multi-project support via `deno.json`. Key directories:
- `apps/cli/src/` contains the interactive `jphw` CLI that prompts for form URLs, saves credentials under `~/.jphw`, and defaults to Chromium unless `--firefox` is provided.
- `apps/server/src/` provides the HTTP(S) API that wraps OpenRouter; `apps/server/data/` holds the persistent cache.
- `packages/client/src/` houses the automation logic shared by the CLI, including Playwright session helpers and server bindings.
- `packages/types/src/` exposes the request/response contracts; extend these before adding new API fields.

Keep new modules colocated with their consumer and export through the relevant package entrypoint.

## Build, Test, and Development Commands
Run everything through Deno tasks so permissions remain consistent:
- `deno task dev` starts both CLI and server in watch mode for integrated workflows.
- `deno task dev:cli` and `deno task dev:server` focus on a single app; use when iterating on prompts or API behaviour.
- `deno task start` runs the CLI once with production flags.
- `deno task build:cli` cross-compiles the CLI to `dist/` (override targets with `JPHW_BUILD_TARGETS`).
- `deno task fmt`, `deno task lint`, and `deno task check` format, lint, and type-check the entire workspace.
- `deno task test` executes the Deno test suite.

## Coding Style & Naming Conventions
Code is TypeScript formatted by `deno fmt` (two-space indent, trailing commas). Use `camelCase` for variables/functions, `PascalCase` for classes and exported types, and prefer `const` plus explicit return types on exported helpers. Keep module boundaries clean by importing through the `@jphw/*` aliases and avoid default exports unless a module truly exposes a single entry point.

## Testing Guidelines
Place new tests alongside source files using the `*_test.ts` suffix (e.g., `apps/server/src/cache_test.ts`). Structure tests with `Deno.test`, group related assertions, and rely on `std/testing/asserts.ts`. Mock network calls via dependency injection (e.g., pass a stubbed `fetch`) so tests stay hermetic. Run `deno task test` locally before opening a PR; target at least one regression test for every bug fix.

## Commit & Pull Request Guidelines
Follow the existing history: short, imperative subjects (`remove console.debug`, `use realpath`). Add body details when explaining rationale or follow-ups. For pull requests, include a concise summary, any relevant issue links, screenshots or terminal captures for user-facing changes, and list the Deno tasks you ran to verify the work. Request review once CI passes and outstanding TODOs are resolved.

## Security & Configuration Tips
Never commit secrets. Provide `OPENROUTER_API_KEY`, `SERVER_URL`, and optional `PLAYWRIGHT_PROFILE_DIR`/`PORT` via your shell or `.env` file referenced by the Deno tasks. The CLI writes credentials to `~/.jphw/credentials.json`; ensure filesystem permissions restrict access. Rotate API keys immediately if logs show unexpected failures.
To expose the server over HTTPS, set `TLS_CERT_FILE` and `TLS_KEY_FILE` to PEM-encoded certificate and key paths; both must be present or the server falls back to HTTP with a warning.
