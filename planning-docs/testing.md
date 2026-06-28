# Testing & conformance

## Strategy

We need two levels:

1. **Unit tests** for parser, evaluator semantics, and each builtin.
2. **Conformance tests** by comparing to `jq` CLI output for supported features (optional; requires `jq` installed).

## Conformance harness (recommended)

- Maintain a corpus of test cases:
  - input JSON
  - jq expression
  - expected output (as JSON stream)
  - notes: relevant context or known differences
- For each test case:
  - Run `jq` CLI (pinned version) to produce expected output
  - Run jq-ts engine to produce output
  - Compare streams exactly (with deterministic formatting rules)

## Guardrails tests

- Validate that disallowed features are rejected:
  - `import/include`
  - external I/O builtins (`input`, `inputs`, `env`, …)
  - any unsupported builtin
- Validate that `now` throws when no clock is injected (`EvalOptions.now`).
