import type { ClassItem, Shorthand } from './ast'

const NEWLINE = 0x0a

/** True if `cp` is an ASCII digit `0-9`. */
const isDigit = (cp: number): boolean => cp >= 0x30 && cp <= 0x39

/** True if `cp` is an ASCII word character `[A-Za-z0-9_]`. */
export const isWord = (cp: number): boolean =>
  isDigit(cp) || cp === 0x5f || (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)

/** True if `cp` is ASCII whitespace (space, tab, newline, CR, FF, VT). */
const isSpace = (cp: number): boolean =>
  cp === 0x20 || cp === 0x09 || cp === NEWLINE || cp === 0x0d || cp === 0x0c || cp === 0x0b

/** True if `cp` satisfies the (possibly negated) shorthand class. */
const shorthandMatches = (cls: Shorthand, cp: number): boolean => {
  switch (cls) {
    case 'd':
      return isDigit(cp)
    case 'D':
      return !isDigit(cp)
    case 'w':
      return isWord(cp)
    case 'W':
      return !isWord(cp)
    case 's':
      return isSpace(cp)
    case 'S':
      return !isSpace(cp)
  }
}

/**
 * Folds a codepoint to its lowercase form for case-insensitive comparison.
 * Uses locale-independent `String#toLowerCase`, which is deterministic and
 * isolate-safe (no RegExp, no host/Node APIs).
 */
const fold = (cp: number): number => {
  const lowered = String.fromCodePoint(cp).toLowerCase()
  const first = lowered.codePointAt(0)
  return first === undefined ? cp : first
}

/** Yields case-folding variants of `cp` to probe under the `i` flag. */
const caseVariants = (cp: number): number[] => {
  const ch = String.fromCodePoint(cp)
  const lower = ch.toLowerCase().codePointAt(0)
  const upper = ch.toUpperCase().codePointAt(0)
  const out = [cp]
  if (lower !== undefined && lower !== cp) out.push(lower)
  if (upper !== undefined && upper !== cp) out.push(upper)
  return out
}

/** True if two codepoints are equal, honoring case-folding when `ignoreCase`. */
export const charEquals = (a: number, b: number, ignoreCase: boolean): boolean =>
  a === b || (ignoreCase && fold(a) === fold(b))

const itemMatches = (item: ClassItem, cp: number): boolean => {
  switch (item.kind) {
    case 'char':
      return item.cp === cp
    case 'range':
      return cp >= item.lo && cp <= item.hi
    case 'shorthand':
      return shorthandMatches(item.cls, cp)
  }
}

const anyItemMatches = (items: ClassItem[], cp: number): boolean => {
  for (const item of items) if (itemMatches(item, cp)) return true
  return false
}

/**
 * True if `cp` is accepted by a bracketed character class.
 *
 * @param items - The class members.
 * @param negated - Whether the class was written as `[^...]`.
 * @param cp - The candidate codepoint.
 * @param ignoreCase - Whether the `i` flag is active.
 */
export const classMatches = (
  items: ClassItem[],
  negated: boolean,
  cp: number,
  ignoreCase: boolean
): boolean => {
  const probes = ignoreCase ? caseVariants(cp) : [cp]
  let inside = false
  for (const probe of probes) {
    if (anyItemMatches(items, probe)) {
      inside = true
      break
    }
  }
  return negated ? !inside : inside
}
