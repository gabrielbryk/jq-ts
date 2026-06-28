import type { FilterNode } from '../ast'
import { parseBreak, parseIf, parseTry } from './branches'
import { finishIdentifier, parseStringInterpolation } from './calls'
import { parseArray, parseObject } from './collections'
import { parseLeadingDot } from './fieldaccess'
import { parseForeach, parseReduce } from './loops'
import type { ParserState } from './state'
import { literalNode, spanBetween } from './state'

export function parsePrimary(p: ParserState): FilterNode {
  if (p.match('Dot')) {
    return parseLeadingDot(p, p.previous())
  }
  if (p.match('Null')) return literalNode(null, p.previous().span)
  if (p.match('True')) return literalNode(true, p.previous().span)
  if (p.match('False')) return literalNode(false, p.previous().span)
  if (p.match('Number')) {
    return literalNode(Number(p.previous().value), p.previous().span)
  }
  if (p.match('String')) {
    return literalNode(String(p.previous().value), p.previous().span)
  }
  if (p.match('StringStart')) {
    return parseStringInterpolation(p, p.previous())
  }
  if (p.match('Variable')) {
    const token = p.previous()
    return {
      kind: 'Var',
      name: String(token.value),
      span: token.span,
    }
  }
  if (p.match('Identifier')) {
    return finishIdentifier(p, p.previous())
  }
  if (p.match('If')) {
    return parseIf(p, p.previous())
  }
  if (p.match('LParen')) {
    const start = p.previous()
    const expr = p.parseDef(p)
    const close = p.consume('RParen', 'Expected ")" after expression')
    expr.span = spanBetween(start.span, close.span)
    return expr
  }
  if (p.match('LBracket')) {
    return parseArray(p, p.previous())
  }
  if (p.match('LBrace')) {
    return parseObject(p, p.previous())
  }
  if (p.match('Reduce')) return parseReduce(p, p.previous())
  if (p.match('Foreach')) return parseForeach(p, p.previous())
  if (p.match('Try')) return parseTry(p, p.previous())
  if (p.match('DotDot')) return { kind: 'Recurse', span: p.previous().span }
  if (p.match('Break')) return parseBreak(p, p.previous())
  if (p.match('Not')) return finishIdentifier(p, p.previous())
  throw p.error(p.peek(), 'Unexpected token')
}
