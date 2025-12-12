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
  - notes: which milestone introduced it
- For each test case:
  - Run `jq` CLI (pinned version) to produce expected output
  - Run jq-ts engine to produce output
  - Compare streams exactly (with deterministic formatting rules)

## Guardrails tests

- Validate that disallowed features are rejected:
  - `now`
  - `import/include`
  - any unsupported builtin

## Property-based tests (later)

- Generate random JSON inputs and random expressions from the supported grammar subset, and ensure:
  - evaluator never crashes
  - limits behave correctly
  - results match jq CLI for the overlapping subset
