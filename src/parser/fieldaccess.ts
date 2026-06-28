import type { FilterNode } from '../ast'
import type { Token } from '../tokens'
import type { ParserState } from './state'
import { spanBetween } from './state'

export function finishFieldAccess(p: ParserState, target: FilterNode): FilterNode {
  if (p.match('Identifier')) {
    const token = p.previous()
    return {
      kind: 'FieldAccess',
      target,
      field: String(token.value),
      span: spanBetween(target.span, token.span),
    }
  }
  if (p.match('String')) {
    const token = p.previous()
    return {
      kind: 'FieldAccess',
      target,
      field: String(token.value),
      span: spanBetween(target.span, token.span),
    }
  }
  throw p.error(p.peek(), 'Expected field name after "."')
}

export function parseLeadingDot(p: ParserState, dot: Token): FilterNode {
  let expr: FilterNode = { kind: 'Identity', span: dot.span }
  for (;;) {
    if (p.check('Identifier') || p.check('String')) {
      expr = finishFieldAccess(p, expr)
      continue
    }
    const suffixed = p.parseBracketSuffix(p, expr)
    if (suffixed) {
      expr = suffixed
      continue
    }
    break
  }
  return expr
}
