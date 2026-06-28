import type { FilterNode } from '../ast'
import { parseAssignment } from './logical'
import { parseBindingPattern } from './patterns'
import type { ParserState } from './state'
import { spanBetween } from './state'

export function parseBinding(p: ParserState, allowComma = true): FilterNode {
  if (p.match('Label')) {
    const start = p.previous()
    const varToken = p.consume('Variable', 'Expected variable name after "label"')
    p.consume('Pipe', 'Expected "|" after label')
    const body = parseBinding(p, allowComma)
    return {
      kind: 'Label',
      label: String(varToken.value),
      body,
      span: spanBetween(start.span, body.span),
    }
  }

  let expr = parsePipe(p, allowComma)
  while (p.match('As')) {
    const pattern = parseBindingPattern(p)
    p.consume('Pipe', 'Expected "|" after binding pattern')
    const body = parseBinding(p, allowComma)
    expr = {
      kind: 'As',
      bind: expr,
      pattern,
      body,
      span: spanBetween(expr.span, body.span),
    }
  }
  return expr
}

export function parsePipe(p: ParserState, allowComma = true): FilterNode {
  let expr = parseComma(p, allowComma)
  while (p.match('Pipe')) {
    const right = parseComma(p, allowComma)
    expr = {
      kind: 'Pipe',
      left: expr,
      right,
      span: spanBetween(expr.span, right.span),
    }
  }
  return expr
}

export function parseComma(p: ParserState, allowComma = true): FilterNode {
  let expr = parseAssignment(p)
  if (!allowComma) return expr
  while (p.match('Comma')) {
    const right = parseAssignment(p)
    expr = {
      kind: 'Comma',
      left: expr,
      right,
      span: spanBetween(expr.span, right.span),
    }
  }
  return expr
}
