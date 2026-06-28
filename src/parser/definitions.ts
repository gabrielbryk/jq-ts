import type { FilterNode } from '../ast'
import { parseBinding } from './precedence'
import type { ParserState } from './state'
import { spanBetween } from './state'

export function parseFilter(p: ParserState): FilterNode {
  const expr = parseDef(p)
  p.consume('EOF', 'Expected end of expression')
  return expr
}

export function parseDef(p: ParserState, allowComma = true): FilterNode {
  if (p.match('Def')) {
    const startSpan = p.previous().span
    const nameToken = p.consume('Identifier', 'Expected function name')
    const name = String(nameToken.value)

    const args: string[] = []
    if (p.match('LParen')) {
      if (!p.check('RParen')) {
        do {
          const argToken = p.consume('Identifier', 'Expected argument name')
          args.push(String(argToken.value))
        } while (p.match('Semicolon'))
      }
      p.consume('RParen', 'Expected ")" after arguments')
    }

    p.consume('Colon', 'Expected ":" after function signature')
    // Function body always permits comma; the trailing expression inherits
    // the caller's allowComma so comma stays restricted in contexts like
    // object values and array elements.
    const body = parseDef(p, true)

    p.consume('Semicolon', 'Expected ";" after function body')
    const next = parseDef(p, allowComma)

    return {
      kind: 'Def',
      name,
      args,
      body,
      next,
      span: spanBetween(startSpan, next.span),
    }
  }
  return parseBinding(p, allowComma)
}
