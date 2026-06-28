import type { BinaryOp, FilterNode } from '../ast'
import type { TokenKind } from '../tokens'
import { parsePostfix } from './postfix'
import type { ParserState } from './state'
import { makeBinary, spanBetween } from './state'

const COMPARE_OPS: { [K in TokenKind]?: BinaryOp } = {
  EqualEqual: 'Eq',
  BangEqual: 'Neq',
  Less: 'Lt',
  LessEqual: 'Lte',
  Greater: 'Gt',
  GreaterEqual: 'Gte',
}

const ADD_OPS: { [K in TokenKind]?: BinaryOp } = {
  Plus: '+',
  Minus: '-',
}

const MUL_OPS: { [K in TokenKind]?: BinaryOp } = {
  Star: '*',
  Slash: '/',
  Percent: '%',
}

/**
 * Parses a left-associative binary level driven by an operator-token map.
 * Produces {@link makeBinary} nodes, identical to the explicit if-chains it
 * replaces.
 */
function binaryLevel(
  p: ParserState,
  ops: { [K in TokenKind]?: BinaryOp },
  next: (p: ParserState) => FilterNode
): FilterNode {
  let expr = next(p)
  for (;;) {
    const op = ops[p.peek().kind]
    if (op === undefined) break
    p.advance()
    expr = makeBinary(expr, next(p), op)
  }
  return expr
}

export function parseComparison(p: ParserState): FilterNode {
  return binaryLevel(p, COMPARE_OPS, parseAdd)
}

function parseAdd(p: ParserState): FilterNode {
  return binaryLevel(p, ADD_OPS, parseMul)
}

function parseMul(p: ParserState): FilterNode {
  return binaryLevel(p, MUL_OPS, parseUnary)
}

function parseUnary(p: ParserState): FilterNode {
  if (p.match('Minus')) {
    const op = p.previous()
    const expr = parseUnary(p)
    return {
      kind: 'Unary',
      op: 'Neg',
      expr,
      span: spanBetween(op.span, expr.span),
    }
  }
  return parsePostfix(p)
}
