# Supported subset

jq-ts implements a **maximal jq subset** that remains deterministic and isolate-safe for embedded use (e.g., as an expression engine inside other DSLs). This document describes what the interpreter accepts today; the per-feature jq 1.8 comparison lives in [`compatibility.md`](compatibility.md).

## Design target

Support as much of jq as possible, gated by static validation + execution limits, except for features that break determinism or isolate safety:

- **External modules** via `.jq` files (`import` / `include`) — unnecessary for inline expressions and unsupported.
- **External I/O / environment access** (`input`, `inputs`, `env`, `$ENV`, `debug`, and equivalents) — unsupported.
- **Host clock access** — the interpreter never reads the system clock. The `now` builtin resolves only to a caller-injected instant (`EvalOptions.now`) and throws when none is provided. Pure date builtins are deterministic functions of their input.

## Supported syntax

- Literals: `null`, `true`, `false`, numbers, strings (with interpolation).
- Identity `.`; field/index access `.foo`, `."foo bar"`, `.[0]`, `.[expr]`; optional access `.foo?`, `.[expr]?`.
- Slices `.[a:b]` and recursive descent `..`.
- Array/object construction `[expr, …]`, `{key: value, …}`, computed keys `{(expr): value}`.
- Composition: pipe `a | b`, comma `a, b`, parentheses.
- Conditionals: `if a then b elif c then d else e end`.
- Boolean ops `and`, `or`, `not`; comparisons `== != < <= > >=`.
- Arithmetic `+ - * / %` and unary `-`; alternative `a // b`.
- Bindings and destructuring: `expr as $x | …`, including array/object destructuring patterns.
- Inline function definitions: `def name(args): expr;` (no module system).
- Error handling: `try a catch b`.
- Reduction/iteration forms: `reduce`, `foreach`.
- Assignment/update operators: `=`, `|=`, `+=`, `-=`, `*=`, `/=`, `%=`, `//=`.

## Supported builtins

A broad set of deterministic builtins is implemented across types/conversions, collections, strings, math, generators, path operations, and an injectable-clock date suite. See the [README builtins list](../README.md#builtins) for a categorized summary and [`compatibility.md`](compatibility.md) for the full jq 1.8 matrix.

## Unsupported

- Regex family (`test`, `match`, `capture`, `scan`, regex `split`/`sub`/`gsub`).
- Format/encoding filters (`@json`, `@csv`, `@base64`, …).
- Streaming helpers (`fromstream`, `truncate_stream`) and the destructuring alternative operator `?//`.

## Validation model

1. Parse → AST.
2. Validate: all AST node types supported, all called builtins supported and allowed, all operators supported.
3. Interpret under execution limits.

## Why external modules aren't needed

Expressions are evaluated inline; authors can use inline `def …;` to structure complex expressions without separate `.jq` module files.
