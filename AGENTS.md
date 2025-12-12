# Repository Guidelines

jq-ts is a pure TypeScript implementation of a Workflow-safe subset of the jq query language. Code in
`src/` must be deterministic and isolate-friendly (see `docs/requirements.md`).

## Project Structure & Module Organization

- `src/` — library source (public entrypoint: `src/index.ts`)
- `test/` — Vitest unit tests (`*.test.ts`)
- `docs/` — design/requirements/subset notes (update when behavior changes)
- `.changeset/` — release notes and version bumps
- `dist/` — build output (generated; do not edit by hand)

## Build, Test, and Development Commands

- `pnpm install` — install dependencies (lockfile: `pnpm-lock.yaml`)
- `pnpm run dev` — run Vitest in watch mode
- `pnpm run test` — run tests once (includes jq-integration suite; auto-skips if `jq` missing)
- `pnpm run test:coverage` — run tests + coverage (80% thresholds)
- `pnpm run typecheck` — TypeScript typecheck (`tsc --noEmit`)
- `pnpm run lint` — ESLint on `src/`
- `pnpm run format:write` — format the repo with Prettier
- `pnpm run build` — build CJS/ESM + `.d.ts` via `tsdown` into `dist/`
- `pnpm run ci` — local preflight (build + format check + exports + lint + tests)

## Coding Style & Naming Conventions

- Indentation: 2 spaces (see `.editorconfig`); formatting via Prettier (no semicolons, single quotes).
- Keep the public API surfaced from `src/index.ts`; add JSDoc for exported symbols.
- Prefer explicit, deterministic logic; avoid hidden global state.

## Testing Guidelines

- Framework: Vitest; place tests under `test/` and name them `*.test.ts`.
- Add tests for new syntax/builtins and keep `docs/testing.md` in sync with the approach.

## Commit & Pull Request Guidelines

- Conventional Commits are enforced by commitlint (e.g., `feat: add ...`, `fix: handle ...`; header
  ≤100 chars).
- Run `pnpm run ci` before opening a PR and follow `.github/pull_request_template.md`.
- For user-facing changes, add a Changeset: `pnpm exec changeset` (or `npx changeset`).

## Determinism & Security Notes

- Do not use Node.js built-ins (`fs`, `path`, etc.) in `src/` (tests may, but keep core isolate-safe).
- Avoid non-determinism: `Date`, `Math.random`, locale/timezone-dependent `Intl`, and unspecified
  ordering. If behavior must be defined, document it and test it.
