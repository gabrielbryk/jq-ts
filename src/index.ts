import { parse } from './parser'
import { validate } from './validate'
import { runAst, type EvalOptions } from './eval'
import type { Value } from './value'
import { LimitTracker, resolveLimits, type LimitsConfig, type ResolvedLimits } from './limits'
import { LexError, ParseError, ValidationError, RuntimeError } from './errors'

export { parse, validate, runAst, LimitTracker, resolveLimits }
export type { EvalOptions, Value, LimitsConfig, ResolvedLimits }
export { LexError, ParseError, ValidationError, RuntimeError }

/**
 * Runs a jq query against a JSON input.
 *
 * @param source - The jq query string (e.g., `.foo | .bar`).
 * @param input - The JSON input value (object, array, string, number, boolean, or null).
 * @param options - Execution options including limits.
 * @returns An array of results. jq queries always produce zero or more values.
 * @throws {LexError} If the query contains invalid characters.
 * @throws {ParseError} If the query syntax is invalid.
 * @throws {ValidationError} If the query uses unsupported features.
 * @throws {RuntimeError} If execution fails (e.g., type error) or exceeds limits.
 */
export const run = (source: string, input: Value, options: EvalOptions = {}): Value[] => {
  const ast = parse(source)
  validate(ast)
  return runAst(ast, input, options)
}
