import type { Cursor } from './cursor'
import { RegexError } from './errors'

const WS = new Set([0x20, 0x09, 0x0a, 0x0d, 0x0c, 0x0b])
const HASH = 0x23
const NEWLINE = 0x0a

/** Skips unescaped whitespace and `#` comments under the extended (`x`) flag. */
export const skipExtended = (cur: Cursor, extended: boolean): void => {
  if (!extended) return
  for (;;) {
    const cp = cur.peek()
    if (cp === undefined) return
    if (WS.has(cp)) {
      cur.next()
      continue
    }
    if (cp === HASH) {
      while (!cur.eof() && cur.peek() !== NEWLINE) cur.next()
      continue
    }
    return
  }
}

const isDigit = (cp: number | undefined): boolean => cp !== undefined && cp >= 0x30 && cp <= 0x39

const readInt = (cur: Cursor): number | null => {
  let digits = ''
  while (isDigit(cur.peek())) digits += String.fromCodePoint(cur.next() as number)
  return digits.length === 0 ? null : parseInt(digits, 10)
}

/**
 * Attempts to parse a `{n}`, `{n,}`, or `{n,m}` quantifier at the cursor.
 * Returns `null` (and leaves the cursor unmoved) when the braces do not form a
 * valid counted quantifier, so the caller can treat `{` as a literal.
 */
export const parseBrace = (cur: Cursor): { min: number; max: number | null } | null => {
  const start = cur.pos
  cur.next() // consume '{'
  const min = readInt(cur)
  if (min === null) {
    cur.pos = start
    return null
  }
  let max: number | null = min
  if (cur.eat(0x2c)) {
    max = readInt(cur) // may be null for {n,}
  }
  if (!cur.eat(0x7d)) {
    cur.pos = start
    return null
  }
  if (max !== null && max < min) throw new RegexError('quantifier range out of order')
  return { min, max }
}

const isNameChar = (cp: number): boolean =>
  (cp >= 0x30 && cp <= 0x39) ||
  cp === 0x5f ||
  (cp >= 0x41 && cp <= 0x5a) ||
  (cp >= 0x61 && cp <= 0x7a)

/** Reads a group name up to and including the closing `>`. */
export const readGroupName = (cur: Cursor): string => {
  let name = ''
  for (;;) {
    const cp = cur.next()
    if (cp === undefined) throw new RegexError('unterminated group name')
    if (cp === 0x3e) break // '>'
    if (!isNameChar(cp)) throw new RegexError('invalid character in group name')
    name += String.fromCodePoint(cp)
  }
  if (name.length === 0) throw new RegexError('empty group name')
  return name
}
