import type { ClassItem } from './ast'
import type { Cursor } from './cursor'
import { RegexError } from './errors'
import { isPosixClass } from './posix'

const LBRACKET = 0x5b
const RBRACKET = 0x5d
const COLON = 0x3a
const CARET = 0x5e

const isLetter = (cp: number | undefined): boolean =>
  cp !== undefined && ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a))

/**
 * Attempts to parse a POSIX bracket class (`[:alpha:]`, `[:^digit:]`) at the
 * cursor, which must sit on the inner `[`. Returns the parsed class item, or
 * `null` (leaving the cursor unmoved) when the `[:...:]` shape is incomplete so
 * the caller can treat `[` as an ordinary class member.
 *
 * @throws {RegexError} When the shape is well-formed but names an unknown class.
 */
export const tryParsePosix = (cur: Cursor): ClassItem | null => {
  if (cur.peek() !== LBRACKET || cur.peek(1) !== COLON) return null
  const start = cur.pos
  cur.next() // '['
  cur.next() // ':'
  const negated = cur.eat(CARET)
  let name = ''
  while (isLetter(cur.peek())) name += String.fromCodePoint(cur.next() as number)
  if (!cur.eat(COLON) || !cur.eat(RBRACKET)) {
    cur.pos = start
    return null
  }
  if (!isPosixClass(name)) {
    throw new RegexError(`unsupported regex feature: POSIX class [[:${name}:]]`)
  }
  return { kind: 'posix', cls: name, negated }
}
