import { LexError } from '../errors'
import { isDigit } from './char-classes'
import { advance, makeSpan, peek, pushToken, type Scanner } from './scanner'

/**
 * Scans a numeric literal (integer, fraction, exponent) starting at the
 * current position and returns the offset just past it.
 */
const readNumber = (s: Scanner, tokenStart: number): number => {
  while (isDigit(peek(s))) advance(s)
  if (peek(s) === '.' && isDigit(peek(s, 1))) {
    advance(s)
    while (isDigit(peek(s))) advance(s)
  }
  if (peek(s) === 'e' || peek(s) === 'E') {
    advance(s)
    if (peek(s) === '+' || peek(s) === '-') advance(s)
    if (!isDigit(peek(s))) {
      throw new LexError(`Invalid exponent in number literal`, makeSpan(tokenStart, s.pos))
    }
    while (isDigit(peek(s))) advance(s)
  }
  return s.pos
}

/**
 * Emits a `Number` token when the current character begins a numeric literal.
 * Returns whether a token was produced.
 */
export const scanNumber = (s: Scanner, start: number): boolean => {
  if (!isDigit(peek(s))) return false

  const end = readNumber(s, start)
  const raw = s.text.slice(start, end)
  const value = Number(raw)
  if (!Number.isFinite(value)) {
    throw new LexError(`Invalid number literal: ${raw}`, makeSpan(start, end))
  }
  pushToken(s, 'Number', start, end, value)
  return true
}
