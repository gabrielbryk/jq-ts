import type { ArrayNode, FilterNode, ObjectEntry, ObjectKey, ObjectNode } from '../ast'
import type { Token } from '../tokens'
import type { ParserState } from './state'
import { spanBetween } from './state'

export function parseArray(p: ParserState, start: Token): ArrayNode {
  const items: FilterNode[] = []
  if (!p.match('RBracket')) {
    do {
      items.push(p.parseDef(p, false))
    } while (p.match('Comma'))
    p.consume('RBracket', 'Expected "]" after array elements')
  }
  return {
    kind: 'Array',
    items,
    span: spanBetween(start.span, p.previous().span),
  }
}

export function parseObject(p: ParserState, start: Token): ObjectNode {
  const entries: ObjectEntry[] = []
  if (!p.match('RBrace')) {
    do {
      entries.push(parseObjectEntry(p))
    } while (p.match('Comma'))
    p.consume('RBrace', 'Expected "}" after object entries')
  }
  return {
    kind: 'Object',
    entries,
    span: spanBetween(start.span, p.previous().span),
  }
}

function parseObjectEntry(p: ParserState): ObjectEntry {
  const key = parseObjectKey(p)
  let value: FilterNode
  if (p.match('Colon')) {
    value = p.parseDef(p, false)
  } else {
    // Shorthand syntax: { id } -> { id: .id }
    if (key.kind === 'KeyIdentifier') {
      value = shorthandValue(key.name, key.span)
    } else if (key.kind === 'KeyString') {
      value = shorthandValue(key.value, key.span)
    } else {
      throw p.error(p.peek(), 'Expected ":" after object key')
    }
  }
  return { key, value }
}

function shorthandValue(field: string, span: ObjectKey['span']): FilterNode {
  return {
    kind: 'FieldAccess',
    target: { kind: 'Identity', span },
    field,
    span,
  }
}

function parseObjectKey(p: ParserState): ObjectKey {
  if (p.match('Identifier')) {
    const token = p.previous()
    return {
      kind: 'KeyIdentifier',
      name: String(token.value),
      span: token.span,
    }
  }
  if (p.match('String')) {
    const token = p.previous()
    return {
      kind: 'KeyString',
      value: String(token.value),
      span: token.span,
    }
  }
  if (p.match('LParen')) {
    const start = p.previous()
    const expr = p.parseComma(p)
    const closing = p.consume('RParen', 'Expected ")" after computed key expression')
    return {
      kind: 'KeyExpr',
      expr,
      span: spanBetween(start.span, closing.span),
    }
  }
  throw p.error(p.peek(), 'Expected identifier, string, or "(expr)" as object key')
}
