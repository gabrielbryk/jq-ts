import { LexError, ParseError, RuntimeError, ValidationError } from './errors'
import { type EvalOptions, runAst } from './eval'
import { type LimitsConfig, LimitTracker, type ResolvedLimits, resolveLimits } from './limits'
import { parse } from './parser'
import { validate } from './validate'
import type { Value } from './value'

export { LimitTracker, parse, resolveLimits, runAst, validate }
export { analyzeCompatibility, checkCompatibility, compareWithJq } from './compat'
export type { EvalOptions, LimitsConfig, ResolvedLimits, Value }
export type {
  CompareWithJqResult,
  CompatibilityAnalysisResult,
  CompatibilityCheckResult,
  CompatibilityFinding,
  CompatibilityFindingCategory,
  CompatibilityFindingSeverity,
  CompatibilityStage,
  ExecutionResult,
  JqRunner,
} from './compat'
export { LexError, ParseError, RuntimeError, ValidationError }

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
