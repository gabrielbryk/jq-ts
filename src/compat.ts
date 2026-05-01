import type { FilterNode, ObjectEntry, ObjectKey } from './ast'
import { LexError, ParseError, RuntimeError, ValidationError, type JqTsError } from './errors'
import { parse } from './parser'
import { runAst, type EvalOptions } from './eval'
import { validate } from './validate'
import { valueEquals, type Value } from './value'

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

const semanticWarnings: Record<string, string> = {
  unique: 'jq sorts unique results; jq-ts preserves first-seen order for determinism.',
  unique_by: 'jq sorts unique_by results by key; jq-ts preserves first-seen order.',
  to_entries: 'jq preserves object insertion order; jq-ts sorts object keys deterministically.',
  with_entries: 'jq preserves object insertion order; jq-ts processes object keys in sorted order.',
  tostring:
    'jq stringifies objects in input key order; jq-ts uses stable sorted-key stringification.',
  tojson: 'jq tojson preserves input object order; jq-ts uses stable sorted-key stringification.',
  infinite:
    'jq serializes infinite as a finite JSON number; jq-ts returns JavaScript Infinity internally.',
  normal:
    'jq documents isnormal; jq-ts exposes normal with approximate JavaScript number semantics.',
  subnormal: 'jq documents subnormal classification; jq-ts currently approximates this as false.',
}

const specialVariableWarnings: Record<string, string> = {
  ENV: 'jq $ENV is an environment snapshot; jq-ts does not populate it unless the caller injects an ENV variable.',
  __loc__:
    'jq $__loc__ reports source location metadata; jq-ts does not populate it unless the caller injects a __loc__ variable.',
  JQ_BUILD_CONFIGURATION:
    'jq $JQ_BUILD_CONFIGURATION reports jq build metadata; jq-ts does not populate it unless the caller injects a JQ_BUILD_CONFIGURATION variable.',
  ARGS: 'jq $ARGS is populated from CLI arguments; jq-ts does not populate it unless the caller injects an ARGS variable.',
}

const syntaxWarningsByKind: Partial<Record<FilterNode['kind'], string>> = {
  Slice:
    'jq slice bounds have jq-specific numeric coercion; jq-ts uses JavaScript slice semantics.',
}

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
  const findings = [...analysis.findings]

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

  const equivalent =
    jqTs.ok && jqResult.ok ? outputStreamsEqual(jqTs.outputs, jqResult.outputs) : null

  if (equivalent === false) {
    findings.push({
      severity: 'error',
      stage: 'compare',
      category: 'output-mismatch',
      message: 'jq-ts output stream does not match jq output stream.',
    })
  }

  return {
    compatible: analysis.compatible && jqTs.ok,
    equivalent,
    analysis,
    jqTs,
    jq: jqResult,
    findings,
  }
}

const runJqTs = (source: string, input: Value, options: EvalOptions): ExecutionResult => {
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

const runExternalJq = (runner: JqRunner, source: string, input: Value): ExecutionResult => {
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

const outputStreamsEqual = (left: Value[], right: Value[]): boolean =>
  left.length === right.length && left.every((value, index) => valueEquals(value, right[index]!))

const toFinding = (err: unknown): CompatibilityFinding | null => {
  const jqTsError = asJqTsError(err)
  if (!jqTsError) return null

  return {
    severity: 'error',
    stage: jqTsError.kind,
    category: classifyError(jqTsError),
    message: jqTsError.message,
    span: jqTsError.span,
  }
}

const asJqTsError = (err: unknown): JqTsError | null => {
  if (
    err instanceof LexError ||
    err instanceof ParseError ||
    err instanceof ValidationError ||
    err instanceof RuntimeError
  ) {
    return err
  }
  return null
}

const classifyError = (err: JqTsError): CompatibilityFindingCategory => {
  if (err.kind === 'parse' || err.kind === 'lex') return 'unsupported-syntax'
  if (err.kind === 'runtime') return 'runtime-error'
  if (err.message.startsWith('Unknown function:')) {
    return isIntentionalExclusion(err.message) ? 'intentional-exclusion' : 'unsupported-builtin'
  }
  if (err.message.includes('expects') && err.message.includes('arguments')) {
    return 'arity-mismatch'
  }
  return 'unsupported-syntax'
}

const isIntentionalExclusion = (message: string): boolean =>
  ['now', 'input', 'inputs', 'env'].some((name) => message === `Unknown function: ${name}`)

const collectWarnings = (node: FilterNode): CompatibilityFinding[] => {
  const warnings: CompatibilityFinding[] = []

  visit(node, (current) => {
    const syntaxWarning = syntaxWarningsByKind[current.kind]
    if (syntaxWarning) {
      warnings.push({
        severity: 'warning',
        stage: 'validate',
        category: 'input-dependent',
        message: syntaxWarning,
        span: current.span,
      })
    }

    if (current.kind === 'Call') {
      const warning = semanticWarnings[current.name]
      if (warning) {
        warnings.push({
          severity: 'warning',
          stage: 'validate',
          category: 'semantic-deviation',
          message: warning,
          span: current.span,
        })
      }
    }

    if (current.kind === 'Var') {
      const warning = specialVariableWarnings[current.name]
      if (warning) {
        warnings.push({
          severity: 'warning',
          stage: 'validate',
          category: current.name === 'ENV' ? 'intentional-exclusion' : 'semantic-deviation',
          message: warning,
          span: current.span,
        })
      }
    }
  })

  return dedupeFindings(warnings)
}

const dedupeFindings = (findings: CompatibilityFinding[]): CompatibilityFinding[] => {
  const seen = new Set<string>()
  const result: CompatibilityFinding[] = []
  for (const finding of findings) {
    const key = `${finding.category}:${finding.message}:${finding.span?.start ?? ''}:${finding.span?.end ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(finding)
  }
  return result
}

const visit = (node: FilterNode, callback: (node: FilterNode) => void): void => {
  callback(node)

  switch (node.kind) {
    case 'Identity':
    case 'Literal':
    case 'Var':
    case 'Recurse':
    case 'Break':
      return
    case 'FieldAccess':
      visit(node.target, callback)
      return
    case 'IndexAccess':
      visit(node.target, callback)
      visit(node.index, callback)
      return
    case 'Iterate':
      visit(node.target, callback)
      return
    case 'Slice':
      visit(node.target, callback)
      if (node.start) visit(node.start, callback)
      if (node.end) visit(node.end, callback)
      return
    case 'Array':
      node.items.forEach((item) => visit(item, callback))
      return
    case 'Object':
      node.entries.forEach((entry) => visitObjectEntry(entry, callback))
      return
    case 'Pipe':
    case 'Comma':
    case 'Alt':
    case 'Binary':
    case 'Bool':
      visit(node.left, callback)
      visit(node.right, callback)
      return
    case 'Unary':
      visit(node.expr, callback)
      return
    case 'If':
      node.branches.forEach((branch) => {
        visit(branch.cond, callback)
        visit(branch.then, callback)
      })
      visit(node.else, callback)
      return
    case 'As':
      visit(node.bind, callback)
      visit(node.body, callback)
      return
    case 'Call':
      node.args.forEach((arg) => visit(arg, callback))
      return
    case 'Reduce':
      visit(node.source, callback)
      visit(node.init, callback)
      visit(node.update, callback)
      return
    case 'Foreach':
      visit(node.source, callback)
      visit(node.init, callback)
      visit(node.update, callback)
      if (node.extract) visit(node.extract, callback)
      return
    case 'Try':
      visit(node.body, callback)
      if (node.handler) visit(node.handler, callback)
      return
    case 'Assignment':
      visit(node.left, callback)
      visit(node.right, callback)
      return
    case 'Def':
      visit(node.body, callback)
      visit(node.next, callback)
      return
    case 'Label':
      visit(node.body, callback)
      return
    default: {
      const exhaustive: never = node
      return exhaustive
    }
  }
}

const visitObjectEntry = (entry: ObjectEntry, callback: (node: FilterNode) => void): void => {
  visitObjectKey(entry.key, callback)
  visit(entry.value, callback)
}

const visitObjectKey = (key: ObjectKey, callback: (node: FilterNode) => void): void => {
  if (key.kind === 'KeyExpr') {
    visit(key.expr, callback)
  }
}
