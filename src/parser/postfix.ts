import type { FilterNode } from '../ast'
import { finishFieldAccess } from './fieldaccess'
import { parsePrimary } from './primary'
import type { ParserState } from './state'
import { spanBetween } from './state'

/**
 * Consumes a bracket suffix (`[...]` index/slice/iterate) or a `?` try
 * suffix on `expr`, returning the wrapped node, or null when the next token
 * is neither. Shared by {@link parsePostfix} and {@link parseLeadingDot}.
 */
export function parseBracketSuffix(p: ParserState, expr: FilterNode): FilterNode | null {
  if (p.match('LBracket')) {
    // Check for [:end]
    if (p.match('Colon')) {
      return finishSlice(p, expr, null)
    }

    if (p.match('RBracket')) {
      const close = p.previous()
      return {
        kind: 'Iterate',
        target: expr,
        span: spanBetween(expr.span, close.span),
      }
    }

    const index = p.parsePipe(p)

    if (p.match('Colon')) {
      return finishSlice(p, expr, index)
    }

    const closing = p.consume('RBracket', 'Expected "]" after index expression')
    return {
      kind: 'IndexAccess',
      target: expr,
      index,
      span: spanBetween(expr.span, closing.span),
    }
  }
  if (p.match('Question')) {
    const op = p.previous()
    return {
      kind: 'Try',
      body: expr,
      handler: undefined,
      span: spanBetween(expr.span, op.span),
    }
  }
  return null
}

/**
 * Finishes a slice suffix after a `:` has been consumed, reading the optional
 * end expression and closing bracket.
 */
function finishSlice(p: ParserState, expr: FilterNode, start: FilterNode | null): FilterNode {
  let end: FilterNode | null = null
  if (!p.check('RBracket')) {
    end = p.parsePipe(p)
  }
  const close = p.consume('RBracket', 'Expected "]" after slice')
  return {
    kind: 'Slice',
    target: expr,
    start,
    end,
    span: spanBetween(expr.span, close.span),
  }
}

export function parsePostfix(p: ParserState): FilterNode {
  let expr = parsePrimary(p)
  for (;;) {
    if (p.match('Dot')) {
      expr = finishFieldAccess(p, expr)
      continue
    }
    const suffixed = parseBracketSuffix(p, expr)
    if (suffixed) {
      expr = suffixed
      continue
    }
    break
  }
  return expr
}
