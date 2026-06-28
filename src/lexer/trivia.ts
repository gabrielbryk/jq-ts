import { isWhitespace } from './char-classes'
import { advance, peek, type Scanner } from './scanner'

/**
 * Consumes a single run of insignificant input (one whitespace char or a
 * whole `#` comment) and returns whether anything was consumed.
 */
export const skipTrivia = (s: Scanner): boolean => {
  const ch = peek(s)
  if (isWhitespace(ch)) {
    advance(s)
    return true
  }
  if (ch === '#') {
    while (s.pos < s.length && peek(s) !== '\n') advance(s)
    return true
  }
  return false
}
