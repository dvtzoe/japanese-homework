# Repository Guidelines

## Project Structure & Module Organization

This monorepo uses the root `deno.json` workspace to share code. Application
entry points live under `apps/`: `apps/cli/src/index.ts` hosts the interactive
CLI, while `apps/server/src/index.ts` is the HTTP service shell. Shared modules
live under `packages/`, e.g. `packages/client` exports reusable client logic and
`packages/types` centralizes TypeScript definitions. Place new code inside the
relevant `src` directory and co-locate fixtures or mocks under
`src/__fixtures__`. Tests should sit beside the code they exercise as
`*.test.ts` files.

## Build, Test, and Development Commands

Run all commands from the repository root. `deno task dev` starts the default
watch server; use `deno task dev:cli` or `deno task dev:server` for app-specific
loops. `deno task start` runs the CLI with required permissions. Quality gates
include `deno task fmt`, `deno task lint`, and `deno task check` for formatting,
linting, and type-checking respectively. `deno task test` executes the full test
suite.

## Coding Style & Naming Conventions

Rely on `deno fmt` for formatting. TypeScript is compiled in strict mode; prefer
explicit return types on exported modules. Name files in kebab-case, exported
symbols in camelCase, types and classes in PascalCase. Keep modules small and
re-export shared utilities through `packages/client` or `packages/types`.

## Testing Guidelines

Author tests with the built-in Deno testing APIs. Name files `*.test.ts` and
describe blocks with the behavior under test. Use
`deno task test --filter="feature name"` to focus on a subset. When adding
coverage-sensitive work, run `deno task test --coverage=coverage` and ensure
important paths are exercised; prune the `coverage/` directory before
committing. Mock external services via dependency injection rather than network
calls.

## Commit & Pull Request Guidelines

Commit messages follow the short imperative pattern seen in history ("add cli
prompt", "fix lint issue"); keep the first line under 72 characters. Group
related changes per commit. For pull requests, include a concise summary, link
the tracking issue, note the commands executed (e.g. fmt, lint, test), and
attach screenshots or terminal transcripts when CLI behavior changes. Confirm
secrets remain in `.env` and are never committed.

## Environment & Security Notes

Copy `.env` locally to provide API tokens; never commit real credentials. Prefer
reading configuration via environment variables instead of hardcoding values.
Review dependencies when updating Deno or third-party modules, and run the full
CI task set before merging.
