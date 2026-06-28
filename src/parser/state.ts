import type { BinaryOp, FilterNode, LiteralValue } from '../ast'
import { ParseError } from '../errors'
import type { Span } from '../span'
import type { Token, TokenKind } from '../tokens'

/**
 * Holds the token stream and cursor for a single parse, and exposes the
 * low-level navigation primitives shared by every parsing routine.
 */
export class ParserState {
  current = 0

  // Recursive grammar entry points injected by `parse()` (see ../parser.ts).
  // Routines that would otherwise reach "up" the descent chain call these
  // through the state object, keeping the per-rule modules free of the
  // back-edge imports that would form module cycles.
  parseDef!: (p: ParserState, allowComma?: boolean) => FilterNode
  parsePipe!: (p: ParserState, allowComma?: boolean) => FilterNode
  parseComma!: (p: ParserState, allowComma?: boolean) => FilterNode
  parseBracketSuffix!: (p: ParserState, expr: FilterNode) => FilterNode | null

  constructor(readonly tokens: Token[]) {}

  match(kind: TokenKind): boolean {
    if (this.check(kind)) {
      this.advance()
      return true
    }
    return false
  }

  consume(kind: TokenKind, message: string): Token {
    if (this.check(kind)) return this.advance()
    throw this.error(this.peek(), message)
  }

  check(kind: TokenKind): boolean {
    if (this.isAtEnd()) return kind === 'EOF'
    return this.peek().kind === kind
  }

  advance(): Token {
    if (!this.isAtEnd()) this.current += 1
    return this.previous()
  }

  isAtEnd(): boolean {
    return this.peek().kind === 'EOF'
  }

  peek(): Token {
    return this.tokens[this.current] ?? { kind: 'EOF', span: { start: 0, end: 0 } }
  }

  previous(): Token {
    return this.tokens[this.current - 1] ?? { kind: 'EOF', span: { start: 0, end: 0 } }
  }

  error(token: Token, message: string): ParseError {
    return new ParseError(message, token.span)
  }
}

export const spanBetween = (a: Span, b: Span): Span => ({
  start: Math.min(a.start, b.start),
  end: Math.max(a.end, b.end),
})

export const literalNode = (value: LiteralValue, span: Span): FilterNode => ({
  kind: 'Literal',
  value,
  span,
})

export const makeBinary = (left: FilterNode, right: FilterNode, op: BinaryOp): FilterNode => ({
  kind: 'Binary',
  op,
  left,
  right,
  span: spanBetween(left.span, right.span),
})
