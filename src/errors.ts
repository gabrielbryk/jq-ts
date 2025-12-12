import type { Span } from './span'

/**
 * Categories of errors that can occur during processing.
 * - `lex`: Errors during lexical analysis (invalid characters).
 * - `parse`: Errors during parsing (syntax errors).
 * - `validate`: Errors during semantics checking (unsupported features).
 * - `runtime`: Errors during execution (type errors, limits).
 */
export type ErrorKind = 'lex' | 'parse' | 'validate' | 'runtime'

/**
 * Common interface for all errors thrown by the jq-ts library.
 */
export interface JqTsError extends Error {
  /** The category of the error. */
  kind: ErrorKind
  /** The source code span where the error occurred. */
  span: Span
}

class BaseError extends Error implements JqTsError {
  kind: ErrorKind
  span: Span

  constructor(kind: ErrorKind, message: string, span: Span) {
    super(message)
    this.kind = kind
    this.span = span
    const pascalKind = kind.charAt(0).toUpperCase() + kind.slice(1)
    this.name = `${pascalKind}Error`
  }
}

/**
 * Thrown when the lexer encounters invalid input characters.
 */
export class LexError extends BaseError {
  constructor(message: string, span: Span) {
    super('lex', message, span)
  }
}

/**
 * Thrown when the parser encounters invalid syntax.
 */
export class ParseError extends BaseError {
  constructor(message: string, span: Span) {
    super('parse', message, span)
  }
}

/**
 * Thrown when the AST contains unsupported or invalid features (e.g., restricted operators).
 */
export class ValidationError extends BaseError {
  constructor(message: string, span: Span) {
    super('validate', message, span)
  }
}

/**
 * Thrown during execution for runtime issues (type errors, limits exceeded, user-raised errors).
 */
export class RuntimeError extends BaseError {
  constructor(message: string, span: Span) {
    super('runtime', message, span)
  }
}
