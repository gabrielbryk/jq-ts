# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**jq-ts** is a pure TypeScript implementation of the jq query language, designed to run safely inside Temporal TypeScript Workflow isolates. It's a deterministic, side-effect-free interpreter with strict safety limits to protect against untrusted user expressions.

**Key constraint**: No filesystem/network/environment access, no time-dependent operations, no randomness—suitable for deterministic workflow execution.

## Development Commands

| Command                               | Purpose                           |
| ------------------------------------- | --------------------------------- |
| `pnpm run dev`                        | Run tests in watch mode           |
| `pnpm run build`                      | Build package (CJS + ESM + types) |
| `pnpm run test`                       | Run all tests once                |
| `pnpm run test -- --reporter=verbose` | Run tests with detailed output    |
| `pnpm run test [filename]`            | Run a specific test file          |
| `pnpm run typecheck`                  | Run TypeScript type checking      |
| `pnpm run lint`                       | Run ESLint on `src/`              |
| `pnpm run lint:fix`                   | Auto-fix linting issues           |
| `pnpm run format:write`               | Format all code with Prettier     |

## Architecture

The codebase follows a classic interpreter pipeline:

1. **Lexer** (`src/lexer.ts`) → tokenizes input with position tracking
2. **Parser** (`src/parser.ts`) → builds an AST from tokens
3. **Validator** (`src/validate.ts`) → rejects unsupported constructs
4. **Evaluator** (`src/value.ts`) → executes filters as streams of values

### Core Abstractions

- **AST** (`src/ast.ts`): Defines all node types (Identity, Literal, FieldAccess, Pipe, Comma, etc.)
- **Tokens** (`src/tokens.ts`): Token kinds and their mapping to keywords
- **Span** (`src/span.ts`): Location tracking (offsets) and formatting for error messages
- **Errors** (`src/errors.ts`): Custom error types
- **Limits** (`src/limits.ts`): Safety constraints (maxSteps, maxDepth, maxOutputs, etc.)

### Semantic Model: "Stream of Values"

Filters can yield **zero, one, or many values**. This is modeled as:

- `Value`: JSON-like types (null, boolean, number, string, array, object)
- `Run`: `Iterable<Value>` representing the stream produced by evaluating a filter

This enables correct semantics for:

- **Comma** `,` → concatenates streams
- **Pipe** `|` → feeds each output into the next filter
- **Alt** `//` → fallback when left yields no values
- **select()**, **map()** → filtering and transforming streams

### Determinism Guarantees

The interpreter enforces:

- **No time operations**: no `now`, no `Date.now()`, no timezone/locale formatting
- **No randomness**: no `Math.random()`
- **No I/O**: no filesystem, network, or environment variable access
- **Canonical ordering**: object key iteration follows a deterministic convention (typically lexicographic sort)

### Safety Limits

Untrusted expressions are protected by configurable limits:

- `maxSteps`: instruction/evaluation step budget
- `maxDepth`: recursion depth limit
- `maxOutputs`: cap on emitted values
- `maxStringLength`, `maxArrayLength`, `maxObjectKeys`: optional caps on intermediate values

## Documentation

- **docs/design.md** — Architecture, semantic model, determinism, safety limits
- **docs/requirements.md** — Constraints and compatibility contract
- **docs/workflow-dsl.md** — Integration with Workflow DSL expressions
- **docs/subset.md** — Supported syntax and builtins
- **docs/testing.md** — Conformance testing strategy
- **docs/roadmap.md** — Milestones and planned features

## Testing Strategy

Tests use **Vitest** and are organized by component:

- `test/lexer.test.ts` — Token generation
- `test/parser.test.ts` — AST construction
- `test/validate.test.ts` — Expression validation

Each test file mirrors its source counterpart. When adding features, ensure corresponding tests exist and pass before committing.

## Code Patterns

### Adding a New Filter Operation

1. Add a new `*Node` interface in `src/ast.ts`
2. Add corresponding token(s) in `src/tokens.ts` if needed
3. Update `src/lexer.ts` to recognize tokens
4. Update `src/parser.ts` to build AST nodes from tokens
5. Add validation logic in `src/validate.ts` if needed
6. Implement evaluation in `src/value.ts`
7. Add test coverage in the relevant test file

### Error Handling

Use typed error classes from `src/errors.ts`:

- `LexError` for lexer issues
- `ParseError` for syntax problems
- `ValidationError` for unsupported constructs
- `EvalError` for runtime issues

Always include `Span` information for good error messages.

## Pre-commit Hooks

The project uses **Husky + lint-staged** to automatically:

- Run Prettier on staged files
- Run ESLint and enforce fixes
- Run type checking

Commits follow **Conventional Commits** format (checked by Commitlint).

## Package Structure

The built package exports from `src/index.ts` and is available in three formats:

- **CommonJS** (`dist/index.cjs`) — for Node.js/CommonJS environments
- **ESM** (`dist/index.js`) — for modern modules
- **TypeScript** (`dist/index.d.ts`) — type definitions

Exports are validated with `pnpm run check-exports` before releases.
