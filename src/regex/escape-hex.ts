import type { Cursor } from './cursor'
import { RegexError } from './errors'

const LBRACE = 0x7b
const RBRACE = 0x7d

const isHex = (cp: number | undefined): boolean =>
  cp !== undefined &&
  ((cp >= 0x30 && cp <= 0x39) || (cp >= 0x41 && cp <= 0x46) || (cp >= 0x61 && cp <= 0x66))

/** Reads exactly `count` hex digits as a codepoint (used by `\xHH`, `\uHHHH`). */
export const readHex = (cur: Cursor, count: number): number => {
  let value = 0
  for (let i = 0; i < count; i++) {
    const cp = cur.next()
    if (!isHex(cp)) throw new RegexError('invalid hex escape in pattern')
    value = value * 16 + parseInt(String.fromCodePoint(cp as number), 16)
  }
  return value
}

/** Reads a `\u{...}` brace escape or a four-digit `\uHHHH` escape. */
export const readUnicode = (cur: Cursor): number => {
  if (!cur.eat(LBRACE)) return readHex(cur, 4)
  let value = 0
  let digits = 0
  while (!cur.eat(RBRACE)) {
    const cp = cur.next()
    if (!isHex(cp)) throw new RegexError('invalid \\u{...} escape in pattern')
    value = value * 16 + parseInt(String.fromCodePoint(cp as number), 16)
    digits++
  }
  if (digits === 0) throw new RegexError('empty \\u{...} escape in pattern')
  return value
}
