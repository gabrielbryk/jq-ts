import { LexError } from '../errors'
import { isHexDigit } from './char-classes'
import { advance, makeSpan, peek, type Scanner } from './scanner'

const simpleEscapes: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
}

/**
 * Scans the body of a string literal from the current position, returning the
 * offset just past the terminating `"` or the `\(` interpolation opener.
 */
export const readString = (s: Scanner, tokenStart: number, openQuote: boolean): number => {
  if (openQuote) advance(s) // consume opening "

  while (s.pos < s.length) {
    const current = advance(s)
    if (current === '"') {
      return s.pos
    }
    if (current === '\\') {
      if (peek(s) === '(') {
        advance(s) // consume (
        return s.pos
      }
      const esc = advance(s)
      if (!esc) break
      if ('"\\/bfnrt'.includes(esc)) continue
      if (esc === 'u') {
        for (let i = 0; i < 4; i++) {
          const h = advance(s)
          if (!h || !isHexDigit(h))
            throw new LexError('Invalid Unicode escape', makeSpan(tokenStart, s.pos))
        }
        continue
      }
      throw new LexError(`Invalid escape sequence "\\${esc}"`, makeSpan(tokenStart, s.pos))
    }
  }
  throw new LexError('Unterminated string literal', makeSpan(tokenStart, s.pos))
}

/**
 * Decodes the raw character range `[innerStart, innerEnd)` into its string
 * value, resolving JSON escape sequences.
 */
export const readStringValue = (
  s: Scanner,
  tokenStart: number,
  innerStart: number,
  innerEnd: number
): string => {
  let result = ''
  let i = innerStart
  while (i < innerEnd) {
    const ch = s.text[i]
    if (ch !== '\\') {
      result += ch
      i += 1
      continue
    }

    const next = s.text[i + 1]
    if (!next) throw new LexError('Unexpected end of input', makeSpan(tokenStart, s.pos))

    const simple = simpleEscapes[next]
    if (simple !== undefined) {
      result += simple
      i += 2
      continue
    }
    if (next === 'u') {
      const hex = s.text.slice(i + 2, i + 6)
      result += String.fromCharCode(parseInt(hex, 16))
      i += 6
      continue
    }
    throw new LexError(`Invalid escape sequence "\\${next}"`, makeSpan(tokenStart, s.pos))
  }
  return result
}
