# jq compatibility matrix

Baseline: jq 1.8 manual (`https://jqlang.org/manual/v1.8/`) and local binary `jq-1.8.1`.

Audit status: every top-level section and feature heading from the jq 1.8 manual has a row in this document. The manual's example table contains 256 `jq` command rows; 250 expression-like examples were extracted for a static jq-ts compatibility pass after excluding CLI-only commands. At the time of this audit, 209 of those extracted example expressions parse and validate in jq-ts, 41 are statically unsupported, and 19 accepted examples carry known semantic warnings. These counts are an audit aid, not a conformance guarantee, because some jq behavior is input-dependent.

jq-ts is a deterministic, isolate-safe jq subset. This matrix is organized by the official jq 1.8 manual sections and separates four states:

- **Compatible**: accepted by jq-ts and expected to match jq for ordinary JSON inputs.
- **Partial**: accepted or partly implemented, but with known missing arities, edge behavior, or input-dependent differences.
- **Different by design**: accepted or rejected intentionally to preserve determinism or isolate safety.
- **Unsupported**: jq feature is not accepted by jq-ts today.

## Summary

| Manual area                     | jq-ts status          | Notes                                                                                                                                                                                                          |
| ------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invoking jq                     | Unsupported           | jq-ts is a library, not a CLI. CLI flags, input modes, raw output, modules from files, and process exit behavior are out of scope.                                                                             |
| Basic filters                   | Partial to compatible | Core filters are strong. Optional access and slice coercion have known edge differences.                                                                                                                       |
| Types and values                | Partial               | JSON value model is supported. jq decimal-number preservation and literal-number metadata are not modeled.                                                                                                     |
| Builtin operators and functions | Partial               | Common deterministic builtins are implemented; many jq builtins and arities are missing.                                                                                                                       |
| Conditionals and comparisons    | Partial to compatible | Core conditionals, comparisons, booleans, `//`, `try/catch`, labels, and break are implemented. Some optional/error behavior differs.                                                                          |
| Regular expressions             | Unsupported           | `test`, `match`, `capture`, `scan`, `sub`, `gsub`, regex `split`, and `splits` are not implemented.                                                                                                            |
| Advanced features               | Partial               | `as`, destructuring bindings, `def`, scoping, `isempty`, `limit`, `first(expr)`, `last(expr)`, `nth(n; expr)`, `reduce`, `foreach`, recursion, and generators are implemented. Some jq arities remain missing. |
| Math                            | Partial               | Several math builtins exist, but jq numeric edge behavior, `nan`, `infinite`, and IEEE classification are not fully compatible.                                                                                |
| I/O                             | Different by design   | External input, environment, debug/stderr, filenames, and line numbers are disallowed or unavailable.                                                                                                          |
| Streaming                       | Unsupported           | `--stream`, `tostream`, `fromstream`, and `truncate_stream` are not implemented.                                                                                                                               |
| Assignment                      | Partial to compatible | Common assignment/update forms work, including multi-path updates. Complex edge cases need more conformance coverage.                                                                                          |
| Comments                        | Compatible            | `#` line comments are ignored outside string literals.                                                                                                                                                         |
| Modules                         | Different by design   | `import`, `include`, module metadata, and disk module loading are intentionally unsupported.                                                                                                                   |
| Colors                          | Unsupported           | CLI presentation feature, out of scope.                                                                                                                                                                        |

## Basic filters

| jq feature           | jq-ts status | Notes                                                                                                         |
| -------------------- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| `.`                  | Compatible   | Identity filter.                                                                                              |
| `.foo`, `.foo.bar`   | Compatible   | Missing object keys produce `null`. Wrong input types raise errors.                                           |
| `.foo?`, `.["foo"]?` | Partial      | jq suppresses non-object errors to an empty stream; jq-ts has known edge differences on non-container inputs. |
| `.[<string>]`        | Compatible   | Object lookup by string.                                                                                      |
| `.[<number>]`        | Compatible   | Array lookup, negative indexes, out-of-bounds `null`, and float truncation are covered.                       |
| `.[start:end]`       | Partial      | Arrays and strings work. Float slice bounds differ because jq-ts currently uses JavaScript slice semantics.   |
| `.[]`                | Compatible   | Arrays and object values are iterated.                                                                        |
| `.[]?`               | Partial      | jq suppresses non-array/non-object errors to an empty stream; jq-ts has known edge differences.               |
| `,`                  | Compatible   | Concatenates output streams.                                                                                  |
| `\|`                 | Compatible   | Pipes each left output into the right filter.                                                                 |
| Parentheses          | Compatible   | Grouping works.                                                                                               |

## Types and values

| jq feature                           | jq-ts status | Notes                                                                         |
| ------------------------------------ | ------------ | ----------------------------------------------------------------------------- |
| JSON literals                        | Compatible   | `null`, booleans, strings, and JavaScript numbers are supported.              |
| Number literal preservation          | Partial      | jq may preserve original decimal literal text; jq-ts uses JavaScript numbers. |
| Array construction `[]`              | Compatible   | Collects filter outputs into one array.                                       |
| Object construction `{}`             | Compatible   | Identifier keys, quoted keys, computed keys, and shorthand are supported.     |
| Variable keys in object construction | Partial      | Some shorthand forms work; not every jq object-key shorthand is covered.      |
| Recursive descent `..`               | Compatible   | Basic recursive descent matches jq for JSON trees.                            |

## Builtin operators and functions

| jq feature                                                                                                                           | jq-ts status        | Notes                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `+`                                                                                                                                  | Partial             | Numbers, strings, arrays, objects, and `null` identity are implemented. Deep/object and numeric edge cases need coverage.                          |
| `-`                                                                                                                                  | Compatible          | Number subtraction and array difference are implemented.                                                                                           |
| `*`, `/`, `%`                                                                                                                        | Partial             | Core numeric/string/object cases are implemented. Division/modulo by zero error text differs.                                                      |
| `abs`                                                                                                                                | Compatible          | Number input only.                                                                                                                                 |
| `length`                                                                                                                             | Compatible          | Strings, arrays, objects, and numeric absolute value are implemented.                                                                              |
| `utf8bytelength`                                                                                                                     | Compatible          | Implemented for strings.                                                                                                                           |
| `keys`                                                                                                                               | Compatible          | Arrays and sorted object keys.                                                                                                                     |
| `keys_unsorted`                                                                                                                      | Partial             | Implemented, but object order follows JavaScript insertion order of the input value.                                                               |
| `has(key)`                                                                                                                           | Compatible          | Arrays and objects, including float index truncation.                                                                                              |
| `in`                                                                                                                                 | Compatible          | Implemented for object keys and array indexes.                                                                                                     |
| `map(f)`                                                                                                                             | Compatible          | Array map.                                                                                                                                         |
| `map_values(f)`                                                                                                                      | Compatible          | Implemented for arrays and objects.                                                                                                                |
| `pick(pathexps)`                                                                                                                     | Compatible          | Implemented for path expressions, including missing path null materialization.                                                                     |
| `path(path_expression)`                                                                                                              | Compatible          | Basic path extraction works.                                                                                                                       |
| `del(path_expression)`                                                                                                               | Compatible          | Implemented using jq-style path expressions.                                                                                                       |
| `getpath(PATHS)`                                                                                                                     | Compatible          | Implemented.                                                                                                                                       |
| `setpath(PATHS; VALUE)`                                                                                                              | Compatible          | Implemented.                                                                                                                                       |
| `delpaths(PATHS)`                                                                                                                    | Compatible          | Implemented.                                                                                                                                       |
| `to_entries`                                                                                                                         | Different by design | jq preserves input object order; jq-ts sorts keys for deterministic output.                                                                        |
| `from_entries`                                                                                                                       | Compatible          | Implemented for jq's `key`/`Key`/`name`/`Name` and `value`/`Value` entry forms.                                                                    |
| `with_entries(f)`                                                                                                                    | Different by design | Works, but object traversal is sorted for determinism.                                                                                             |
| `select(boolean_expression)`                                                                                                         | Compatible          | Implemented with jq truthiness.                                                                                                                    |
| Type filters: `arrays`, `objects`, `iterables`, `booleans`, `numbers`, `normals`, `finites`, `strings`, `nulls`, `values`, `scalars` | Compatible          | Implemented as jq-style input-or-empty filters.                                                                                                    |
| `empty`                                                                                                                              | Compatible          | Emits no outputs.                                                                                                                                  |
| `error`, `error(message)`                                                                                                            | Compatible          | Implemented. Error text is jq-ts specific.                                                                                                         |
| `halt`, `halt_error`                                                                                                                 | Unsupported         | CLI/process-exit behavior is out of scope.                                                                                                         |
| `$__loc__`                                                                                                                           | Unsupported         | Not implemented.                                                                                                                                   |
| `paths`                                                                                                                              | Compatible          | Zero-arity traversal is implemented.                                                                                                               |
| `paths(node_filter)`                                                                                                                 | Compatible          | Predicate-filter form is implemented.                                                                                                              |
| `add`                                                                                                                                | Compatible          | Implemented for arrays of compatible values and empty arrays.                                                                                      |
| `add(generator)`                                                                                                                     | Compatible          | Generator arity is implemented.                                                                                                                    |
| `any`, `any(condition)`, `any(generator; condition)`                                                                                 | Compatible          | Zero-, one-, and two-argument forms are implemented.                                                                                               |
| `all`, `all(condition)`, `all(generator; condition)`                                                                                 | Compatible          | Zero-, one-, and two-argument forms are implemented.                                                                                               |
| `flatten`, `flatten(depth)`                                                                                                          | Compatible          | Implemented.                                                                                                                                       |
| `range` forms                                                                                                                        | Compatible          | One-, two-, and three-argument forms are implemented.                                                                                              |
| `floor`                                                                                                                              | Compatible          | Implemented.                                                                                                                                       |
| `sqrt`                                                                                                                               | Compatible          | Implemented for numbers.                                                                                                                           |
| `tonumber`                                                                                                                           | Compatible          | Implemented for strings and numbers.                                                                                                               |
| `toboolean`                                                                                                                          | Partial             | Implemented with jq truthiness; jq's exact documented behavior should be kept under test.                                                          |
| `tostring`                                                                                                                           | Different by design | Object keys are stringified in deterministic sorted order, unlike jq input order.                                                                  |
| `type`                                                                                                                               | Compatible          | Implemented.                                                                                                                                       |
| `infinite`, `nan`, `isinfinite`, `isnan`, `isfinite`, `isnormal`                                                                     | Partial             | Implemented with JavaScript numeric values; serialization of `NaN`/`Infinity` differs from jq's CLI JSON output.                                   |
| `sort`, `sort_by(path_expression)`                                                                                                   | Compatible          | Stable sorting with jq value ordering.                                                                                                             |
| `group_by(path_expression)`                                                                                                          | Compatible          | Implemented.                                                                                                                                       |
| `min`, `max`, `min_by`, `max_by`                                                                                                     | Compatible          | Implemented for arrays.                                                                                                                            |
| `unique`, `unique_by(path_exp)`                                                                                                      | Different by design | jq sorts unique results; jq-ts preserves first-seen order.                                                                                         |
| `reverse`                                                                                                                            | Compatible          | Array reverse is implemented; string input errors like local `jq-1.8.1`.                                                                           |
| `contains(element)`                                                                                                                  | Compatible          | Recursive contains implemented.                                                                                                                    |
| `indices(s)`                                                                                                                         | Compatible          | String and array search implemented.                                                                                                               |
| `index(s)`, `rindex(s)`                                                                                                              | Compatible          | String and array search implemented.                                                                                                               |
| `inside`                                                                                                                             | Compatible          | Implemented as inverse of `contains`.                                                                                                              |
| `startswith`, `endswith`                                                                                                             | Compatible          | Implemented for strings.                                                                                                                           |
| `combinations`, `combinations(n)`                                                                                                    | Compatible          | Implemented.                                                                                                                                       |
| `ltrimstr`, `rtrimstr`                                                                                                               | Compatible          | Implemented.                                                                                                                                       |
| `trimstr`, `trim`, `ltrim`, `rtrim`                                                                                                  | Compatible          | Implemented for strings.                                                                                                                           |
| `explode`, `implode`                                                                                                                 | Compatible          | Codepoint-based implementation.                                                                                                                    |
| `split(str)`                                                                                                                         | Compatible          | Literal string split implemented.                                                                                                                  |
| `split(regex; flags)`                                                                                                                | Unsupported         | Regex split is not implemented.                                                                                                                    |
| `join(str)`                                                                                                                          | Compatible          | Implemented for strings, numbers, booleans, and null; arrays/objects still error like jq.                                                          |
| `ascii_downcase`, `ascii_upcase`                                                                                                     | Compatible          | Implemented as ASCII-only casing.                                                                                                                  |
| `while`, `repeat`, `until`                                                                                                           | Compatible          | Implemented with execution limits.                                                                                                                 |
| `recurse(f)`, `recurse`                                                                                                              | Compatible          | Zero- and one-argument forms are implemented, along with `..`.                                                                                     |
| `recurse(f; condition)`                                                                                                              | Compatible          | Implemented.                                                                                                                                       |
| `walk(f)`                                                                                                                            | Compatible          | Implemented with deterministic object-key traversal.                                                                                               |
| `have_literal_numbers`, `have_decnum`, `$JQ_BUILD_CONFIGURATION`                                                                     | Unsupported         | jq build/configuration features are not modeled. `$JQ_BUILD_CONFIGURATION` can parse as an injected variable name, but jq-ts does not populate it. |
| `$ENV`, `env`                                                                                                                        | Different by design | Environment access is intentionally unavailable. `$ENV` can parse as an injected variable name, but jq-ts does not populate it.                    |
| `transpose`                                                                                                                          | Compatible          | Implemented.                                                                                                                                       |
| `bsearch(x)`                                                                                                                         | Compatible          | Implemented.                                                                                                                                       |
| String interpolation `\(exp)`                                                                                                        | Compatible          | Implemented via `tostring`; object key order follows jq-ts stable stringification.                                                                 |
| `tojson`, `fromjson`                                                                                                                 | Partial             | Implemented with deterministic sorted-key object stringification, unlike jq's input-order `tojson`.                                                |
| Format strings: `@json`, `@csv`, `@tsv`, `@sh`, `@base64`, `@uri`, etc.                                                              | Unsupported         | Not implemented.                                                                                                                                   |
| Dates                                                                                                                                | Unsupported         | Time/date builtins are excluded unless a deterministic subset is explicitly added.                                                                 |
| SQL-style operators                                                                                                                  | Unsupported         | `INDEX`, `JOIN`, and related SQL-style helpers are not implemented.                                                                                |
| `builtins`                                                                                                                           | Unsupported         | Not implemented.                                                                                                                                   |

## Conditionals and comparisons

| jq feature                 | jq-ts status | Notes                                         |
| -------------------------- | ------------ | --------------------------------------------- |
| `==`, `!=`                 | Compatible   | Deep equality implemented.                    |
| `>`, `>=`, `<=`, `<`       | Compatible   | jq type ordering implemented for JSON values. |
| `if then else end`, `elif` | Compatible   | Implemented.                                  |
| `and`, `or`, `not`         | Compatible   | Implemented with jq truthiness.               |
| `//`                       | Compatible   | Implemented.                                  |
| `try/catch`                | Compatible   | Implemented.                                  |
| `label`, `break`           | Compatible   | Implemented.                                  |
| Optional operator `?`      | Compatible   | Implemented through error suppression.        |

## Regular expressions

| jq feature                         | jq-ts status | Notes            |
| ---------------------------------- | ------------ | ---------------- |
| `test`, `match`, `capture`, `scan` | Unsupported  | Not implemented. |
| Regex `split`, `splits`            | Unsupported  | Not implemented. |
| `sub`, `gsub`                      | Unsupported  | Not implemented. |

## Advanced features

| jq feature                                  | jq-ts status | Notes                                                                                                                           |
| ------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `... as $identifier \| ...`                 | Compatible   | Simple variable binding works.                                                                                                  |
| Destructuring binding                       | Compatible   | Variable, array, object, nested, string-key, and `{$var}` shorthand patterns are implemented for `as`, `reduce`, and `foreach`. |
| Destructuring alternative `?//`             | Unsupported  | Not implemented.                                                                                                                |
| `def`                                       | Compatible   | Inline definitions, arguments, scoping, and recursion work.                                                                     |
| `isempty(exp)`                              | Compatible   | Implemented.                                                                                                                    |
| `limit(n; expr)`                            | Compatible   | Implemented.                                                                                                                    |
| `skip(n; expr)`                             | Compatible   | Implemented.                                                                                                                    |
| `first(expr)`, `last(expr)`, `nth(n; expr)` | Compatible   | Implemented.                                                                                                                    |
| `first`, `last`, `nth(n)`                   | Compatible   | jq convenience arities are implemented for array input.                                                                         |
| `reduce`                                    | Compatible   | Implemented.                                                                                                                    |
| `foreach`                                   | Compatible   | Implemented.                                                                                                                    |
| Recursion                                   | Compatible   | Recursive `def` and recursive generators are supported, bounded by limits.                                                      |
| Generators and iterators                    | Partial      | Core generator model is implemented. Some jq generator helper arities are missing.                                              |

## I/O, streaming, modules, comments, and colors

| jq feature                                              | jq-ts status        | Notes                                                  |
| ------------------------------------------------------- | ------------------- | ------------------------------------------------------ |
| `input`, `inputs`                                       | Different by design | External input streams are intentionally unavailable.  |
| `debug`, `stderr`                                       | Different by design | Side-effecting output is unavailable.                  |
| `input_filename`, `input_line_number`                   | Different by design | No file/input-stream context exists.                   |
| `--stream`, `tostream`, `fromstream`, `truncate_stream` | Unsupported         | Streaming parser representation is not implemented.    |
| Comments                                                | Compatible          | `#` line comments are ignored outside string literals. |
| `import`, `include`, `module`, `modulemeta`             | Different by design | Disk-backed modules are intentionally unavailable.     |
| Colors and `JQ_COLORS`                                  | Unsupported         | CLI presentation feature, out of scope.                |

## Compatibility helper APIs

The package exposes three compatibility helpers:

| Function                                                   | Purpose                                                                                                  | Guarantee                                                              |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `checkCompatibility(source)`                               | Parse and statically validate a jq expression against the jq-ts subset.                                  | Answers "will jq-ts accept this expression?"                           |
| `analyzeCompatibility(source)`                             | Runs the static check and adds warnings for known jq-vs-jq-ts semantic differences.                      | Answers "is this accepted, and are there known compatibility hazards?" |
| `compareWithJq(source, input, jqRunnerOrResult, options?)` | Runs jq-ts and compares its output stream with caller-provided jq output or a caller-provided jq runner. | Answers "does this expression match jq for this input?"                |

`compareWithJq` does not spawn the jq binary itself. That keeps `src/` isolate-safe and avoids Node.js built-ins in runtime code. Tests or developer tooling may pass a runner that shells out to `jq`.

## Manual example audit

The jq 1.8 manual example table was extracted and each expression-like command was run through `checkCompatibility` and `analyzeCompatibility`.

| Result                              | Count | Meaning                                                                       |
| ----------------------------------- | ----: | ----------------------------------------------------------------------------- |
| Manual `jq` command rows            |   256 | Raw example commands in the manual's HTML example tables.                     |
| Expression-like examples classified |   250 | Examples with extractable jq expressions after removing CLI-only commands.    |
| Statically accepted by jq-ts        |   209 | Expression parsed and validated by jq-ts.                                     |
| Statically unsupported by jq-ts     |    41 | Expression failed lexing, parsing, validation, or builtin arity checks.       |
| Accepted with semantic warnings     |    19 | Expression is accepted but uses a feature with known jq-vs-jq-ts differences. |

Unsupported manual examples group by these causes:

| Cause                                  | Examples from the manual                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Unsupported conversion/formatting      | `@json`, `@csv`, `@base64`, and related `@...` formatters.                                           |
| Regex family                           | `test`, `match`, `capture`, `scan`, regex `split`, `splits`, `sub`, `gsub`.                          |
| Missing builtin helpers                | `fromstream`, `truncate_stream`, regex helpers, date helpers, SQL-style helpers, and module helpers. |
| Missing arities                        | Regex `split(regex; flags)` and other unsupported regex/date/streaming arities.                      |
| Destructuring alternative syntax       | The destructuring alternative operator `?//` is not implemented.                                     |
| Date/time and build metadata           | `fromdate`, `strptime`, `have_decnum`, `nan`, jq build configuration helpers.                        |
| Intentional environment/I/O exclusions | `env`, `$ENV`, external input, debug/stderr, filename, and line number features.                     |

Accepted manual examples with warnings group by these causes:

| Warning group          | Why it matters                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Stable key ordering    | jq generally preserves input object order; jq-ts sorts in `tostring`, `to_entries`, and related deterministic operations.                |
| Slice bounds           | jq has jq-specific numeric coercion for slice bounds; jq-ts currently relies on JavaScript slice semantics.                              |
| Coercive builtins      | Some jq conversion helpers accept/coerce more input types than jq-ts.                                                                    |
| Ordered uniqueness     | jq `unique`/`unique_by` sort results; jq-ts preserves first-seen order by design.                                                        |
| Numeric classification | jq has jq-specific numeric classification and JSON serialization behavior; jq-ts uses JavaScript primitives for current implementations. |

## Maintenance checklist

- When a builtin is added, update this matrix and add at least one jq integration fixture.
- When jq-compatible behavior is intentionally not adopted, document it as "Different by design" rather than "Compatible".
- Keep `test/fixtures/jq-compat.json` focused on behavior that should match jq exactly.
- Add `analyzeCompatibility` warnings for accepted expressions whose behavior is known to differ from jq.
