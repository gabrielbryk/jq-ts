import type { PosixClass } from './ast'

/**
 * POSIX bracket-class membership, evaluated over the ASCII range.
 *
 * Like the engine's `\d`/`\w`/`\s` shorthands, these classes are deliberately
 * ASCII-only: the isolate-safe interpreter has no Unicode property tables, so
 * matching is deterministic and table-free. jq/Oniguruma treat the same names
 * as Unicode-aware, which is the one documented divergence for non-ASCII input.
 */

const between = (cp: number, lo: number, hi: number): boolean => cp >= lo && cp <= hi

const isUpper = (cp: number): boolean => between(cp, 0x41, 0x5a)
const isLower = (cp: number): boolean => between(cp, 0x61, 0x7a)
const isDigit = (cp: number): boolean => between(cp, 0x30, 0x39)
const isAlpha = (cp: number): boolean => isUpper(cp) || isLower(cp)
const isAlnum = (cp: number): boolean => isAlpha(cp) || isDigit(cp)
const isSpace = (cp: number): boolean => cp === 0x20 || between(cp, 0x09, 0x0d)
const isXDigit = (cp: number): boolean =>
  isDigit(cp) || between(cp, 0x41, 0x46) || between(cp, 0x61, 0x66)
const isGraph = (cp: number): boolean => between(cp, 0x21, 0x7e)

const PREDICATES: Record<PosixClass, (cp: number) => boolean> = {
  alpha: isAlpha,
  digit: isDigit,
  alnum: isAlnum,
  space: isSpace,
  upper: isUpper,
  lower: isLower,
  punct: (cp) => isGraph(cp) && !isAlnum(cp),
  xdigit: isXDigit,
  blank: (cp) => cp === 0x20 || cp === 0x09,
  cntrl: (cp) => between(cp, 0x00, 0x1f) || cp === 0x7f,
  graph: isGraph,
  print: (cp) => between(cp, 0x20, 0x7e),
  word: (cp) => isAlnum(cp) || cp === 0x5f,
}

const POSIX_NAMES = new Set<string>(Object.keys(PREDICATES))

/** True when `name` is a supported POSIX bracket-class name. */
export const isPosixClass = (name: string): name is PosixClass => POSIX_NAMES.has(name)

/** True when `cp` belongs to the POSIX class `cls` (ASCII semantics). */
export const posixMatches = (cls: PosixClass, cp: number): boolean => PREDICATES[cls](cp)
