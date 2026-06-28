import { type EvalOptions, runAst } from '../eval'
import { parse } from '../parser'
import { validate } from '../validate'
import { type Value, valueEquals } from '../value'
import { asJqTsError } from './classify'
import type { CompatibilityFinding, ExecutionResult, JqRunner } from './types'

export const runJqTs = (source: string, input: Value, options: EvalOptions): ExecutionResult => {
  try {
    const ast = parse(source)
    validate(ast)
    return { ok: true, outputs: runAst(ast, input, options) }
  } catch (err) {
    const jqTsError = asJqTsError(err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stage: jqTsError?.kind,
    }
  }
}

export const runExternalJq = (runner: JqRunner, source: string, input: Value): ExecutionResult => {
  try {
    const result = runner(source, input)
    if (Array.isArray(result)) {
      return { ok: true, outputs: result }
    }
    return result
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stage: 'compare',
    }
  }
}

export const outputStreamsEqual = (left: Value[], right: Value[]): boolean =>
  left.length === right.length && left.every((value, index) => valueEquals(value, right[index]!))

export const executionFindings = (
  jqTs: ExecutionResult,
  jqResult: ExecutionResult,
  equivalent: boolean | null
): CompatibilityFinding[] => {
  const findings: CompatibilityFinding[] = []

  if (!jqTs.ok) {
    findings.push({
      severity: 'error',
      stage: jqTs.stage ?? 'runtime',
      category: 'runtime-error',
      message: jqTs.error,
    })
  }

  if (!jqResult.ok) {
    findings.push({
      severity: 'error',
      stage: 'compare',
      category: 'jq-error',
      message: jqResult.error,
    })
  }

  if (equivalent === false) {
    findings.push({
      severity: 'error',
      stage: 'compare',
      category: 'output-mismatch',
      message: 'jq-ts output stream does not match jq output stream.',
    })
  }

  return findings
}
