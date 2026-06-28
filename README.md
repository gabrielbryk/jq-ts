# jq-ts

Pure TypeScript implementation of a deterministic, zero-dependency subset of the **jq query language**. Safe for V8 isolates (no Node.js built-ins, no filesystem/network), making it compatible with Temporal Workflows and other sandboxed runtimes.

## Features

- Parser → validator → interpreter pipeline with span-rich errors.
- Deterministic evaluation: stable object key ordering; configurable limits for steps/depth/outputs; zero runtime dependencies.
- Never touches the host clock, filesystem, network, or environment on its own. Time is available only when you inject it (`options.now`).
- Broad jq builtin coverage — types/conversions, collections, strings, math, generators, path operations, and an injectable-clock date suite (see [Builtins](#builtins)).
- Advanced language features: `reduce`, `foreach`, `try`/`catch`, recursive descent (`..`), assignment/update operators (`=`, `|=`, `+=`, …), and destructuring `as` bindings.
- Dual ESM/CJS builds via `tsdown` with `.d.ts` types.

## Install

```bash
npm install @gabrielbryk/jq-ts
# or: pnpm add @gabrielbryk/jq-ts
```

## Usage

```ts
import { run } from '@gabrielbryk/jq-ts'

const [result] = run('.foo // "fallback"', { foo: null })
// result === "fallback"
```

`run(source, input, options?)` returns an array of results (jq filters yield zero or more values). Options include `limits`, predefined `vars`, and `now`:

```ts
// Seed variables (without the `$` prefix):
run('.[] | . + $bump', [1, 2], { vars: { bump: 10 } }) // => [11, 12]

// `now` and date builtins require an injected instant (a Date or epoch seconds).
// Without it, `now` throws — jq-ts never reads the host clock itself.
run('now | todate', null, { now: 1_700_000_000 }) // => ["2023-11-14T22:13:20Z"]
```

## Builtins

A representative (not exhaustive) view of what's implemented; see [`planning-docs/compatibility.md`](planning-docs/compatibility.md) for the full jq 1.8 matrix.

- **Types & conversion**: `type`, `tostring`, `tonumber`, `toboolean`, `length`, `not`, `has`, `in`, `keys`, `keys_unsorted`, and type filters (`arrays`, `objects`, `booleans`, `numbers`, `strings`, `nulls`, `values`, `iterables`, `scalars`, `finites`, `normals`).
- **Collections**: `map`, `map_values`, `select`, `sort`, `sort_by`, `group_by`, `unique`, `unique_by`, `reverse`, `flatten`, `add`, `min`/`max`/`min_by`/`max_by`, `to_entries`, `from_entries`, `with_entries`, `del`, `pick`, `transpose`, `bsearch`, `combinations`, `contains`, `inside`.
- **Strings**: `split`, `join`, `startswith`, `endswith`, `ltrimstr`/`rtrimstr`/`trimstr`, `trim`/`ltrim`/`rtrim`, `ascii_downcase`, `ascii_upcase`, `explode`, `implode`, `index`, `rindex`, `indices`, `utf8bytelength`, `tojson`, `fromjson`.
- **Math**: `floor`, `ceil`, `round`, `abs`, `sqrt`, `nan`, `infinite`, `isnan`, `isinfinite`, `isfinite`, `isnormal`.
- **Generators & iteration**: `range`, `limit`, `skip`, `first`, `last`, `nth`, `while`, `until`, `repeat`, `recurse`, `isempty`, `all`, `any`, `empty`.
- **Paths**: `path`, `paths`, `getpath`, `setpath`, `delpaths`.
- **Dates** (require an injected clock for `now`): `now`, `gmtime`, `localtime`, `mktime`, `strftime`, `strflocaltime`, `strptime`, `todate`/`todateiso8601`, `fromdate`/`fromdateiso8601`.
- **Errors & control flow**: `error`, `try`/`catch`, `if`/`then`/`elif`/`else`/`end`, `reduce`, `foreach`, inline `def`, `as` destructuring, alternative `//`, and optional `?`.

## Docs

- [`planning-docs/requirements.md`](planning-docs/requirements.md) — determinism and compatibility constraints
- [`planning-docs/compatibility.md`](planning-docs/compatibility.md) — jq 1.8 compatibility matrix and helper API notes
- [`planning-docs/workflow-dsl.md`](planning-docs/workflow-dsl.md) — embedding jq-ts as an expression engine in host DSLs (`${...}` envelopes)
- [`planning-docs/subset.md`](planning-docs/subset.md) — supported syntax and builtins
- [`planning-docs/design.md`](planning-docs/design.md) — interpreter design and safety limits
- [`planning-docs/roadmap.md`](planning-docs/roadmap.md) — milestones
- [`planning-docs/testing.md`](planning-docs/testing.md) — conformance strategy (incl. jq integration fixtures)

## Development

```bash
git clone https://github.com/gabrielbryk/jq-ts.git
cd jq-ts
pnpm install
pnpm run build
```

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
