import type { Shorthand } from './ast'
import type { Cursor } from './cursor'
import { RegexError } from './errors'

/** The semantic value produced by parsing a single `\X` escape. */
export type EscapeValue =
  | { kind: 'char'; cp: number }
  | { kind: 'shorthand'; cls: Shorthand }
  | { kind: 'anchor'; anchor: 'wordB' | 'notWordB' }

const CONTROL: Record<number, number> = {
  0x6e: 0x0a, // \n
  0x72: 0x0d, // \r
  0x74: 0x09, // \t
  0x66: 0x0c, // \f
  0x76: 0x0b, // \v
  0x30: 0x00, // \0
}

const SHORTHANDS = new Set([0x64, 0x44, 0x77, 0x57, 0x73, 0x53]) // d D w W s S

const isHex = (cp: number | undefined): boolean =>
  cp !== undefined &&
  ((cp >= 0x30 && cp <= 0x39) || (cp >= 0x41 && cp <= 0x46) || (cp >= 0x61 && cp <= 0x66))

const readHex = (cur: Cursor, count: number): number => {
  let value = 0
  for (let i = 0; i < count; i++) {
    const cp = cur.next()
    if (!isHex(cp)) throw new RegexError('invalid hex escape in pattern')
    value = value * 16 + parseInt(String.fromCodePoint(cp as number), 16)
  }
  return value
}

const readUnicode = (cur: Cursor): number => {
  if (cur.eat(0x7b)) {
    // \u{...}
    let value = 0
    let digits = 0
    while (!cur.eat(0x7d)) {
      const cp = cur.next()
      if (!isHex(cp)) throw new RegexError('invalid \\u{...} escape in pattern')
      value = value * 16 + parseInt(String.fromCodePoint(cp as number), 16)
      digits++
    }
    if (digits === 0) throw new RegexError('empty \\u{...} escape in pattern')
    return value
  }
  return readHex(cur, 4)
}

const rejectBackref = (cur: Cursor, cp: number, inClass: boolean): void => {
  if (cp === 0x6b) throw new RegexError('unsupported feature: backreference (\\k<name>)')
  if (!inClass && cp >= 0x31 && cp <= 0x39) {
    throw new RegexError('unsupported feature: backreference (\\1)')
  }
}

/**
 * Parses one escape sequence following a backslash. The backslash must already
 * be consumed; the cursor points at the escaped codepoint.
 *
 * @param cur - The pattern cursor.
 * @param inClass - True when parsing inside a `[...]` character class, where
 *   `\b` denotes a backspace rather than a word-boundary assertion.
 * @throws {RegexError} For backreferences or a trailing backslash.
 */
export const parseEscape = (cur: Cursor, inClass: boolean): EscapeValue => {
  const cp = cur.next()
  if (cp === undefined) throw new RegexError('trailing backslash in pattern')
  rejectBackref(cur, cp, inClass)
  if (SHORTHANDS.has(cp)) return { kind: 'shorthand', cls: String.fromCodePoint(cp) as Shorthand }
  if (cp === 0x62) return inClass ? { kind: 'char', cp: 0x08 } : { kind: 'anchor', anchor: 'wordB' }
  if (cp === 0x42 && !inClass) return { kind: 'anchor', anchor: 'notWordB' }
  if (cp === 0x78) return { kind: 'char', cp: readHex(cur, 2) }
  if (cp === 0x75) return { kind: 'char', cp: readUnicode(cur) }
  const control = CONTROL[cp]
  if (control !== undefined) return { kind: 'char', cp: control }
  return { kind: 'char', cp }
}
