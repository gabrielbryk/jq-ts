import type { BindingPattern, ObjectPatternEntry } from '../ast'
import type { Span } from '../span'
import type { ParserState } from './state'
import { spanBetween } from './state'

export function parseBindingPattern(p: ParserState): BindingPattern {
  if (p.match('Variable')) {
    const token = p.previous()
    return {
      kind: 'VariablePattern',
      name: String(token.value),
      span: token.span,
    }
  }

  if (p.match('LBracket')) {
    const start = p.previous()
    const items: BindingPattern[] = []
    if (!p.match('RBracket')) {
      do {
        items.push(parseBindingPattern(p))
      } while (p.match('Comma'))
      p.consume('RBracket', 'Expected "]" after array binding pattern')
    }
    return {
      kind: 'ArrayPattern',
      items,
      span: spanBetween(start.span, p.previous().span),
    }
  }

  if (p.match('LBrace')) {
    const start = p.previous()
    const entries: ObjectPatternEntry[] = []
    if (!p.match('RBrace')) {
      do {
        entries.push(parseObjectBindingPatternEntry(p))
      } while (p.match('Comma'))
      p.consume('RBrace', 'Expected "}" after object binding pattern')
    }
    return {
      kind: 'ObjectPattern',
      entries,
      span: spanBetween(start.span, p.previous().span),
    }
  }

  throw p.error(p.peek(), 'Expected variable or destructuring pattern after "as"')
}

function parseObjectBindingPatternEntry(p: ParserState): ObjectPatternEntry {
  if (p.match('Variable')) {
    const token = p.previous()
    const name = String(token.value)
    return {
      key: name,
      pattern: {
        kind: 'VariablePattern',
        name,
        span: token.span,
      },
      span: token.span,
    }
  }

  let key: string
  let keySpan: Span
  if (p.match('Identifier')) {
    const token = p.previous()
    key = String(token.value)
    keySpan = token.span
  } else if (p.match('String')) {
    const token = p.previous()
    key = String(token.value)
    keySpan = token.span
  } else {
    throw p.error(
      p.peek(),
      'Expected identifier, string, or variable shorthand in object binding pattern'
    )
  }

  p.consume('Colon', 'Expected ":" after object binding pattern key')
  const pattern = parseBindingPattern(p)
  return {
    key,
    pattern,
    span: spanBetween(keySpan, pattern.span),
  }
}
