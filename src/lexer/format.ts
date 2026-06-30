import { LexError } from '../errors'
import { isIdentifierPart } from './char-classes'
import { advance, makeSpan, peek, pushToken, type Scanner } from './scanner'

/**
 * Emits a `Format` token for an `@`-format reference such as `@base64` or
 * `@csv`. The leading `@` must be followed by at least one identifier
 * character; the token's value is the format name without the `@`.
 *
 * Returns whether a token was produced.
 */
export const scanFormat = (s: Scanner, start: number): boolean => {
  if (peek(s) !== '@') return false

  advance(s) // consume '@'
  const nameStart = s.pos
  while (isIdentifierPart(peek(s))) advance(s)
  if (s.pos === nameStart) {
    throw new LexError('Expected a format name after "@"', makeSpan(start, s.pos))
  }
  pushToken(s, 'Format', start, s.pos, s.text.slice(nameStart, s.pos))
  return true
}
