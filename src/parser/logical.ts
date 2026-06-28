import type { AssignmentNode, FilterNode } from '../ast'
import type { TokenKind } from '../tokens'
import { parseComparison } from './binary'
import type { ParserState } from './state'
import { spanBetween } from './state'

type AssignOp = AssignmentNode['op']

const ASSIGN_OPS: { [K in TokenKind]?: AssignOp } = {
  Eq: '=',
  BarEq: '|=',
  PlusEq: '+=',
  MinusEq: '-=',
  StarEq: '*=',
  SlashEq: '/=',
  PercentEq: '%=',
  AltEq: '//=',
}

export function parseAssignment(p: ParserState): FilterNode {
  const expr = parseAlt(p)
  const op = ASSIGN_OPS[p.peek().kind]
  if (op !== undefined) {
    p.advance()
    const right = parseAssignment(p) // Right-associative
    return {
      kind: 'Assignment',
      op,
      left: expr,
      right,
      span: spanBetween(expr.span, right.span),
    }
  }
  return expr
}

function parseAlt(p: ParserState): FilterNode {
  let expr = parseOr(p)
  while (p.match('Alt')) {
    const right = parseOr(p)
    expr = {
      kind: 'Alt',
      left: expr,
      right,
      span: spanBetween(expr.span, right.span),
    }
  }
  return expr
}

function parseOr(p: ParserState): FilterNode {
  let expr = parseAnd(p)
  while (p.match('Or')) {
    const right = parseAnd(p)
    expr = {
      kind: 'Bool',
      op: 'Or',
      left: expr,
      right,
      span: spanBetween(expr.span, right.span),
    }
  }
  return expr
}

function parseAnd(p: ParserState): FilterNode {
  let expr = parseComparison(p)
  while (p.match('And')) {
    const right = parseComparison(p)
    expr = {
      kind: 'Bool',
      op: 'And',
      left: expr,
      right,
      span: spanBetween(expr.span, right.span),
    }
  }
  return expr
}
