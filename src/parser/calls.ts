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

export function parseStringInterpolation(p: ParserState, start: Token): FilterNode {
  const parts: FilterNode[] = [{ kind: 'Literal', value: String(start.value), span: start.span }]

  for (;;) {
    // Parse expression
    const expr = p.parseDef(p)
    parts.push({
      kind: 'Pipe',
      left: expr,
      right: {
        kind: 'Call',
        name: 'tostring',
        args: [],
        span: expr.span,
      },
      span: expr.span,
    })

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
