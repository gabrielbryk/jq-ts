import type { FilterNode } from '../ast'
import type { Token } from '../tokens'
import type { ParserState } from './state'
import { spanBetween } from './state'

export function finishIdentifier(p: ParserState, token: Token): FilterNode {
  if (p.match('LParen')) {
    const args = parseCallArguments(p)
    const closing = p.consume('RParen', 'Expected ")" after arguments')
    return {
      kind: 'Call',
      name: String(token.value),
      args,
      span: spanBetween(token.span, closing.span),
    }
  }
  return {
    kind: 'Call',
    name: String(token.value),
    args: [],
    span: token.span,
  }
}

function parseCallArguments(p: ParserState): FilterNode[] {
  const args: FilterNode[] = []
  if (p.check('RParen')) {
    return args
  }
  do {
    args.push(p.parseDef(p, true))
  } while (p.match('Semicolon'))
  return args
}

/**
 * Wraps an interpolated `\(...)` expression for concatenation into a string.
 * The default wrapper coerces the value with `tostring`; the `@`-format path
 * (see `parser/format.ts`) supplies a wrapper that pipes through the encoder.
 */
export type InterpWrap = (expr: FilterNode) => FilterNode

const tostringWrap: InterpWrap = (expr) => ({
  kind: 'Pipe',
  left: expr,
  right: { kind: 'Call', name: 'tostring', args: [], span: expr.span },
  span: expr.span,
})

/**
 * Builds the desugared concatenation for a string literal containing
 * interpolations, starting from the already-consumed `StringStart` token.
 * Literal segments become string literals; interpolated expressions are passed
 * through `wrap`. The pieces are joined with `+` (string concatenation).
 */
export function buildInterpolation(p: ParserState, start: Token, wrap: InterpWrap): FilterNode {
  const parts: FilterNode[] = [{ kind: 'Literal', value: String(start.value), span: start.span }]

  for (;;) {
    const expr = p.parseDef(p)
    parts.push(wrap(expr))

    if (p.match('StringMiddle')) {
      const token = p.previous()
      parts.push({ kind: 'Literal', value: String(token.value), span: token.span })
      continue
    }
    if (p.match('StringEnd')) {
      const token = p.previous()
      parts.push({ kind: 'Literal', value: String(token.value), span: token.span })
      break
    }
    throw p.error(p.peek(), 'Expected closing paren of interpolation or continuation')
  }

  return parts.reduce((acc, curr) => ({
    kind: 'Binary',
    op: '+', // Use + operator which handles concatenation
    left: acc,
    right: curr,
    span: spanBetween(acc.span, curr.span),
  }))
}

export function parseStringInterpolation(p: ParserState, start: Token): FilterNode {
  return buildInterpolation(p, start, tostringWrap)
}
