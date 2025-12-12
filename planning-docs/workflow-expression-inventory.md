# Workflow expression inventory (from `workflow.yaml`)

Source schema:

- `libs/shared/serverless-workflow-types/schemas/workflow.yaml`

The schema defines `runtimeExpression` as a string that looks like `${ ... }`.

## Expression contexts we need to support well

### Conditions (should evaluate to boolean)

- Task gating: `taskBase.if`
- Switch cases: `switchTask.*.when`
- Loop continuation: `forTask.while`
- Retry: `retryPolicy.when`, `retryPolicy.exceptWhen`
- Catch: `tryTask.catch.when`, `tryTask.catch.exceptWhen`
- Extension condition: `extension.when`
- Subscription consume loops: `asyncApiMessageConsumptionPolicy.while` / `.until`
- Event consumption loops: `eventConsumptionStrategy.until` (for “any event” strategy)

**jq implications**

- strong support for boolean logic, comparisons, null-safe access, and defaults (`?`, `//`)
- predictable truthiness rules

### Data shaping (returns JSON value/object/array)

- Input transform: `input.from`
- Output transform: `output.as`
- Export to context: `export.as`

**jq implications**

- object/array construction, mapping/filtering collections, string/number transforms

### Iteration (returns a collection/sequence)

- For-each source: `forTask.for.in`

**jq implications**

- robust array/object iteration patterns, `map`, `select`, `.[]`, `keys`, etc.

### Filtering / correlation extraction (returns boolean or scalar)

- AsyncAPI subscription filter: `asyncApiSubscription.filter`
- Event correlation extraction: `eventFilter.correlate.*.from`
- Event correlation expectation: `eventFilter.correlate.*.expect` (constant or expression)

**jq implications**

- safe nested extraction, comparisons, string operations

### Dynamic values (string/number-ish)

- Durations can be expressions: `duration` supports `runtimeExpression`
- Endpoint/event properties can be runtime expressions in some places (e.g. endpoint URI, event `source/time/dataschema`, error `type/instance`, call headers/query values)

**jq implications**

- conversions (`tostring`, `tonumber`) and basic formatting helpers

## Practical conclusion: “maximal Workflow-safe jq”

We should aim for broad jq language coverage, with special emphasis on:

- safe extraction + defaults: `.foo?`, `.foo // "default"`
- shaping: `{...}`, `[...]`, pipes, `map`, `select`
- conditions: comparisons, boolean ops

And explicitly reject / omit:

- `now`
- `import/include`
- external I/O / environment access
