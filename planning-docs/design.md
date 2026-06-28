# Design

## High-level architecture

1. **Lexer** → tokens with positions
2. **Parser** → AST (lossless enough to support good errors + formatting later)
3. **Validator** → rejects unsupported constructs/builtins
4. **Evaluator**:
   - Executes filters as **streams of values**
   - Has a scoped environment for `$vars` and `def` functions

## Core semantic model: “stream of values”

jq filters can yield zero, one, or many values.

In TypeScript, model this as:

- `Value` = JSON-like + internal types (numbers, strings, arrays, objects, null, booleans)
- `Run` = `Iterable<Value>` (synchronous) produced by evaluating an AST node

This allows correct semantics for:

- comma `,` (concatenate streams)
- pipe `|` (feed each output into the next filter)
- `//` (fallback when left yields no values)
- `select()` and `map()`

## Determinism

### Disallowed sources

- Time: the interpreter never reads the host clock. `now` resolves only to a caller-injected instant (`EvalOptions.now`) and throws otherwise; pure date builtins are deterministic functions of their input.
- Randomness: no `Math.random()`.
- Environment: no filesystem/network/env vars.

### Canonical ordering

Where ordering is observable:

- Arrays preserve order.
- Object key iteration must be deterministic; define a convention where needed (often lexicographic sort for operations like `keys` and any “sort keys” behavior).

## Safety limits (for untrusted expressions)

Because user expressions are untrusted, we need limits to avoid stalling execution:

- `maxSteps`: instruction/AST-eval step budget
- `maxDepth`: recursion depth budget
- `maxOutputs`: cap number of emitted values
- `maxStringLength` / `maxArrayLength` / `maxObjectKeys`: optional caps for intermediate values

These should be configurable and default to conservative values.

## Execution model

jq-ts evaluates the AST directly with a tree-walking interpreter. It never generates JS source (`new Function`), keeping execution isolate-friendly and auditable.
