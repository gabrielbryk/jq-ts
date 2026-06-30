import type { AnchorKind, Shorthand } from './ast'
import type { Cursor } from './cursor'
import { RegexError } from './errors'
import { readHex, readUnicode } from './escape-hex'

/** The semantic value produced by parsing a single `\X` escape. */
export type EscapeValue =
  | { kind: 'char'; cp: number }
  | { kind: 'shorthand'; cls: Shorthand }
  | { kind: 'anchor'; anchor: AnchorKind }

const LBRACE = 0x7b

const CONTROL: Record<number, number> = {
  0x6e: 0x0a, // \n
  0x72: 0x0d, // \r
  0x74: 0x09, // \t
  0x66: 0x0c, // \f
  0x76: 0x0b, // \v
  0x30: 0x00, // \0
}

const SHORTHANDS = new Set([0x64, 0x44, 0x77, 0x57, 0x73, 0x53]) // d D w W s S

// Absolute (buffer) anchors, keyed by escaped letter: \A \z \Z.
const ANCHORS: Record<number, AnchorKind> = {
  0x41: 'bufStart', // \A
  0x7a: 'bufEnd', // \z
  0x5a: 'bufEndZ', // \Z
}

const isAlphaNum = (cp: number): boolean =>
  (cp >= 0x30 && cp <= 0x39) || (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)

const rejectBackref = (cur: Cursor, cp: number, inClass: boolean): void => {
  // \k<name>, \g1, \g<1>, \g<name>: named/numbered backreferences & subroutines.
  if (cp === 0x6b) throw new RegexError('unsupported regex feature: backreference (\\k<name>)')
  if (cp === 0x67) throw new RegexError('unsupported regex feature: subroutine/backreference (\\g)')
  if (!inClass && cp >= 0x31 && cp <= 0x39) {
    throw new RegexError('unsupported regex feature: backreference (\\1)')
  }
}

const wordBoundary = (cur: Cursor, inClass: boolean): EscapeValue => {
  if (inClass) return { kind: 'char', cp: 0x08 } // \b is a backspace inside [...]
  if (cur.peek() === LBRACE) {
    throw new RegexError('unsupported regex feature: \\b{...} text-boundary')
  }
  return { kind: 'anchor', anchor: 'wordB' }
}

/**
 * Parses one escape sequence following a backslash. The backslash must already
 * be consumed; the cursor points at the escaped codepoint.
 *
 * Unsupported constructs are rejected rather than silently treated as literals:
 * backreferences/subroutines (`\1 \k \g`), Unicode property escapes (`\p \P`),
 * Oniguruma special escapes (`\h \H \R \K \G`, `\b{...}`), and any other
 * unrecognized alphanumeric escape all throw. Escaped punctuation stays literal.
 *
 * @param cur - The pattern cursor.
 * @param inClass - True when parsing inside a `[...]` character class, where
 *   `\b` denotes a backspace rather than a word-boundary assertion and absolute
 *   anchors are not allowed.
 * @throws {RegexError} For unsupported features or a trailing backslash.
 */
export const parseEscape = (cur: Cursor, inClass: boolean): EscapeValue => {
  const cp = cur.next()
  if (cp === undefined) throw new RegexError('trailing backslash in pattern')
  rejectBackref(cur, cp, inClass)
  if (SHORTHANDS.has(cp)) return { kind: 'shorthand', cls: String.fromCodePoint(cp) as Shorthand }
  if (cp === 0x62) return wordBoundary(cur, inClass)
  if (cp === 0x42 && !inClass) return { kind: 'anchor', anchor: 'notWordB' }
  if (cp === 0x78) return { kind: 'char', cp: readHex(cur, 2) }
  if (cp === 0x75) return { kind: 'char', cp: readUnicode(cur) }
  if (!inClass && ANCHORS[cp] !== undefined) return { kind: 'anchor', anchor: ANCHORS[cp] }
  const control = CONTROL[cp]
  if (control !== undefined) return { kind: 'char', cp: control }
  if (isAlphaNum(cp)) {
    throw new RegexError(`unsupported regex feature: \\${String.fromCodePoint(cp)}`)
  }
  return { kind: 'char', cp } // escaped punctuation/metacharacter is a literal
}
