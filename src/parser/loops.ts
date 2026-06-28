import type { FilterNode, ForeachNode, ReduceNode } from '../ast'
import type { Token } from '../tokens'
import { parseBindingPattern } from './patterns'
import type { ParserState } from './state'
import { spanBetween } from './state'

export function parseReduce(p: ParserState, start: Token): ReduceNode {
  const source = p.parsePipe(p)
  p.consume('As', 'Expected "as" after reduce source')
  const pattern = parseBindingPattern(p)
  p.consume('LParen', 'Expected "(" after binding pattern')
  const init = p.parseComma(p)
  p.consume('Semicolon', 'Expected ";" after init')
  const update = p.parseComma(p)
  const end = p.consume('RParen', 'Expected ")" after update')
  return {
    kind: 'Reduce',
    source,
    pattern,
    init,
    update,
    span: spanBetween(start.span, end.span),
  }
}

export function parseForeach(p: ParserState, start: Token): ForeachNode {
  const source = p.parsePipe(p)
  p.consume('As', 'Expected "as" after foreach source')
  const pattern = parseBindingPattern(p)
  p.consume('LParen', 'Expected "(" after binding pattern')
  const init = p.parseComma(p)
  p.consume('Semicolon', 'Expected ";" after init')
  const update = p.parseComma(p)
  let extract: FilterNode | undefined
  if (p.match('Semicolon')) {
    extract = p.parseComma(p)
  }
  const end = p.consume('RParen', 'Expected ")" after foreach body')
  return {
    kind: 'Foreach',
    source,
    pattern,
    init,
    update,
    extract,
    span: spanBetween(start.span, end.span),
  }
}
