import { type EvalOptions } from '../eval'
import { parse } from '../parser'
import { validate } from '../validate'
import { type Value } from '../value'
import { toFinding } from './classify'
import { collectWarnings } from './collect'
import { executionFindings, outputStreamsEqual, runExternalJq, runJqTs } from './execution'
import type {
  CompareWithJqResult,
  CompatibilityAnalysisResult,
  CompatibilityCheckResult,
  ExecutionResult,
  JqRunner,
} from './types'

/**
 * Checks whether a jq expression can be parsed and statically validated by jq-ts.
 *
 * This is a syntax/subset check only. It does not prove that runtime behavior
 * matches the jq binary for every possible input.
 */
export const checkCompatibility = (source: string): CompatibilityCheckResult => {
  try {
    const ast = parse(source)
    validate(ast)
    return { compatible: true, findings: [] }
  } catch (err) {
    const finding = toFinding(err)
    if (finding) {
      return { compatible: false, findings: [finding] }
    }
    throw err
  }
}

/**
 * Checks jq-ts compatibility and reports known semantic differences from jq.
 */
export const analyzeCompatibility = (source: string): CompatibilityAnalysisResult => {
  const check = checkCompatibility(source)
  if (!check.compatible) {
    return { ...check, warnings: [] }
  }

  const ast = parse(source)
  const warnings = collectWarnings(ast)
  return {
    compatible: true,
    findings: warnings,
    warnings,
  }
}

/**
 * Compares jq-ts execution against a caller-provided jq runner or jq result.
 *
 * The function is safe to export from the isolate-safe library because it does
 * not spawn the jq binary itself. Tests and development tools can pass a runner
 * that shells out to jq.
 */
export const compareWithJq = (
  source: string,
  input: Value,
  jq: JqRunner | ExecutionResult,
  options: EvalOptions = {}
): CompareWithJqResult => {
  const analysis = analyzeCompatibility(source)
  const jqTs = runJqTs(source, input, options)
  const jqResult = typeof jq === 'function' ? runExternalJq(jq, source, input) : jq

  const equivalent =
    jqTs.ok && jqResult.ok ? outputStreamsEqual(jqTs.outputs, jqResult.outputs) : null

  const findings = [...analysis.findings, ...executionFindings(jqTs, jqResult, equivalent)]

  return {
    compatible: analysis.compatible && jqTs.ok,
    equivalent,
    analysis,
    jqTs,
    jq: jqResult,
    findings,
  }
}
