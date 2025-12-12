# jq-ts

Pure TypeScript implementation of a deterministic, zero-dependency subset of the **jq query language**. Safe for V8 isolates (no Node.js built-ins, no filesystem/network), making it compatible with Temporal Workflows and other sandboxed runtimes.

## Features

- Parser → validator → interpreter pipeline with span-rich errors.
- Deterministic evaluation: stable object key ordering, limit tracking for steps/depth/outputs; zero runtime dependencies.
- jq-compatible builtins for the current milestone (type/tostring/tonumber/length/keys/has, sort/sort_by, unique/unique_by, map/select, to_entries/from_entries/with_entries, split/join/startswith/endswith/contains).
- **Advanced features**: `reduce`, `foreach`, `try/catch`, recursive descent (`..`), and path operations (`paths`, `getpath`, `setpath`, `delpaths`).
- Dual ESM/CJS builds via `tsdown` and `.d.ts` types.

## Quick Start

```bash
git clone https://github.com/gabrielbryk/jq-ts.git
cd jq-ts
pnpm install
pnpm run build
```

## Usage

```ts
import { run } from 'jq-ts'

const [result] = run('.foo // "fallback"', { foo: null })
// result === "fallback"
```

## Docs

- `planning-docs/requirements.md` — determinism and compatibility constraints
- `planning-docs/workflow-dsl.md` — how jq maps to your Workflow DSL `${...}` expressions
- `planning-docs/subset.md` — supported syntax/builtins by milestone
- `planning-docs/design.md` — interpreter/VM design and safety limits
- `planning-docs/roadmap.md` — milestones
- `planning-docs/testing.md` — conformance strategy (incl. jq integration fixtures)

## Development

Key commands:

- `pnpm run dev` — Vitest watch
- `pnpm run test` — full test suite (includes jq integration; auto-skips if `jq` missing)
- `pnpm run test:coverage` — tests with coverage
- `pnpm run lint` — ESLint
- `pnpm run format:write` — Prettier formatting
- `pnpm run build` — build CJS/ESM + types
- `pnpm run ci` — build + format check + exports + lint + tests

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). We follow Conventional Commits and require `pnpm run ci` before PRs. Contributor guide: [AGENTS.md](AGENTS.md).

## License

MIT
