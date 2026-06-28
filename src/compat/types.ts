import { type Value } from '../value'

export type CompatibilityStage = 'lex' | 'parse' | 'validate' | 'runtime' | 'compare'

export type CompatibilityFindingSeverity = 'error' | 'warning'

export type CompatibilityFindingCategory =
  | 'unsupported-syntax'
  | 'unsupported-builtin'
  | 'arity-mismatch'
  | 'intentional-exclusion'
  | 'semantic-deviation'
  | 'input-dependent'
  | 'runtime-error'
  | 'jq-error'
  | 'output-mismatch'

export interface CompatibilityFinding {
  severity: CompatibilityFindingSeverity
  stage?: CompatibilityStage
  category: CompatibilityFindingCategory
  message: string
  span?: { start: number; end: number }
}

export interface CompatibilityCheckResult {
  compatible: boolean
  findings: CompatibilityFinding[]
}

export interface CompatibilityAnalysisResult extends CompatibilityCheckResult {
  warnings: CompatibilityFinding[]
}

export type ExecutionResult =
  | { ok: true; outputs: Value[] }
  | { ok: false; error: string; stage?: CompatibilityStage }

export interface CompareWithJqResult {
  compatible: boolean
  equivalent: boolean | null
  analysis: CompatibilityAnalysisResult
  jqTs: ExecutionResult
  jq: ExecutionResult
  findings: CompatibilityFinding[]
}

export type JqRunner = (source: string, input: Value) => Value[] | ExecutionResult
