# Roadmap

## Milestone 0: Project skeleton

- Package structure
- Lexer/parser scaffolding
- AST types and error reporting conventions

## Milestone 1: Core language (no builtins beyond basics)

Implement and test:

- Literals, `.`, field/index access, arrays/objects
- `|`, `,`, `//`
- comparisons, arithmetic, boolean ops
- `if/then/elif/else/end`
- variables: `as $x | ...`

## Milestone 2: Standard builtins (v0 subset) [COMPLETED]

- `type`, `tostring`, `tonumber`, `length`
- `map`, `select`
- `keys`, `has`
- `sort`, `sort_by`, `unique`, `unique_by`
- `to_entries`, `from_entries`, `with_entries`
- String helpers: `split`, `join`, `startswith`, `endswith`, `contains`

## Milestone 3: Harder jq features (v1) [COMPLETED]

- `reduce` / `foreach`
- `try/catch`
- recursive descent `..`
- path functions (`paths`, `getpath`, `setpath`, `delpaths`)

## Milestone 4: Performance pass

- Bytecode compiler + VM
- Benchmark suite

## Milestone 5: Optional “bundled modules”

Only if a host DSL ever needs shared libraries across many expressions:

- add `import/include` against a fixed module registry (no disk)
- keep this optional; inline `def ...;` covers most needs
