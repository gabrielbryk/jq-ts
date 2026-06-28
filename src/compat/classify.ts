import { type JqTsError, LexError, ParseError, RuntimeError, ValidationError } from '../errors'
import type { CompatibilityFinding, CompatibilityFindingCategory } from './types'

export const asJqTsError = (err: unknown): JqTsError | null => {
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

// `now` and the date builtins are implemented (see src/builtins/dates.ts), so
// they are no longer excluded. `input`/`inputs` (streaming) and `env`
// (host environment) remain intentional exclusions.
const isIntentionalExclusion = (message: string): boolean =>
  ['input', 'inputs', 'env'].some((name) => message === `Unknown function: ${name}`)

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

export const toFinding = (err: unknown): CompatibilityFinding | null => {
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
