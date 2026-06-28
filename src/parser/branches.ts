import type { FilterNode, TryNode } from '../ast'
import type { Token } from '../tokens'
import type { ParserState } from './state'
import { spanBetween } from './state'

export function parseBreak(p: ParserState, start: Token): FilterNode {
  const varToken = p.consume('Variable', 'Expected variable after "break"')
  return {
    kind: 'Break',
    label: String(varToken.value),
    span: spanBetween(start.span, varToken.span),
  }
}

export function parseTry(p: ParserState, start: Token): TryNode {
  const body = p.parseDef(p, true)
  let handler: FilterNode | undefined
  let endSpan = body.span
  if (p.match('Catch')) {
    handler = p.parseDef(p, true)
    endSpan = handler.span
  }
  return {
    kind: 'Try',
    body,
    handler,
    span: spanBetween(start.span, endSpan),
  }
}

export function parseIf(p: ParserState, start: Token): FilterNode {
  const branches: { cond: FilterNode; then: FilterNode }[] = []
  const firstCond = p.parseDef(p, true)
  p.consume('Then', 'Expected "then" after condition')
  const firstThen = p.parseDef(p, true)
  branches.push({ cond: firstCond, then: firstThen })

  while (p.match('Elif')) {
    const cond = p.parseDef(p, true)
    p.consume('Then', 'Expected "then" after elif condition')
    const thenBranch = p.parseDef(p, true)
    branches.push({ cond, then: thenBranch })
  }

  p.consume('Else', 'Expected "else" in if expression')
  const elseBranch = p.parseDef(p, true)
  const endToken = p.consume('End', 'Expected "end" to close if expression')
  return {
    kind: 'If',
    branches,
    else: elseBranch,
    span: spanBetween(start.span, endToken.span),
  }
}
