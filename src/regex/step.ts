import type { AnchorKind, RegexFlags } from './ast'
import { charEquals, classMatches, isWord } from './chartypes'
import type { Inst } from './program'

const NEWLINE = 0x0a

const wordBoundary = (cps: number[], pos: number): boolean => {
  const before = pos > 0 ? isWord(cps[pos - 1] as number) : false
  const after = pos < cps.length ? isWord(cps[pos] as number) : false
  return before !== after
}

/** Evaluates a zero-width assertion at `pos` against the input codepoints. */
export const assertHolds = (
  kind: AnchorKind,
  cps: number[],
  pos: number,
  flags: RegexFlags
): boolean => {
  switch (kind) {
    case 'start':
      return pos === 0 || (flags.multiline && cps[pos - 1] === NEWLINE)
    case 'end':
      return pos === cps.length || (flags.multiline && cps[pos] === NEWLINE)
    case 'wordB':
      return wordBoundary(cps, pos)
    case 'notWordB':
      return !wordBoundary(cps, pos)
  }
}

/**
 * Tests whether a consuming instruction matches the codepoint `cp` (which is
 * `undefined` at end of input). Control instructions never reach here.
 */
export const instConsumes = (inst: Inst, cp: number | undefined, flags: RegexFlags): boolean => {
  if (cp === undefined) return false
  switch (inst.op) {
    case 'any':
      return flags.dotAll || cp !== NEWLINE
    case 'char':
      return charEquals(cp, inst.cp, flags.ignoreCase)
    case 'class':
      return classMatches(inst.items, inst.negated, cp, flags.ignoreCase)
    default:
      return false
  }
}
