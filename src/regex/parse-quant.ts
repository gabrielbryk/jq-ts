import type { RegexNode } from './ast'
import type { Cursor } from './cursor'
import { RegexError } from './errors'
import { parseBrace, skipExtended } from './parse-util'

const STAR = 0x2a
const PLUS = 0x2b
const QUEST = 0x3f

const readBounds = (cur: Cursor): { min: number; max: number | null } | null => {
  const cp = cur.peek()
  if (cp === STAR) return consume(cur, 0, null)
  if (cp === PLUS) return consume(cur, 1, null)
  if (cp === QUEST) return consume(cur, 0, 1)
  if (cp === 0x7b) return parseBrace(cur)
  return null
}

const consume = (
  cur: Cursor,
  min: number,
  max: number | null
): { min: number; max: number | null } => {
  cur.next()
  return { min, max }
}

/**
 * Applies a trailing quantifier (`*`, `+`, `?`, `{n,m}`) to `atom`, including
 * the lazy `?` suffix. Returns `atom` unchanged when no quantifier follows.
 *
 * @throws {RegexError} On a possessive quantifier suffix (`a++`, `a*+`, ...).
 */
export const parseQuantifier = (cur: Cursor, extended: boolean, atom: RegexNode): RegexNode => {
  skipExtended(cur, extended)
  const bounds = readBounds(cur)
  if (bounds === null) return atom
  let greedy = true
  if (cur.peek() === QUEST) {
    cur.next()
    greedy = false
  } else if (cur.peek() === PLUS) {
    throw new RegexError('unsupported feature: possessive quantifier')
  }
  return { type: 'Repeat', node: atom, min: bounds.min, max: bounds.max, greedy }
}
