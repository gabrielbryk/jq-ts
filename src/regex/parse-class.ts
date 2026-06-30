import type { ClassItem, Shorthand } from './ast'
import type { Cursor } from './cursor'
import { RegexError } from './errors'
import { parseEscape } from './parse-escape'

const RBRACKET = 0x5d
const DASH = 0x2d
const BACKSLASH = 0x5c

type Member = { kind: 'char'; cp: number } | { kind: 'shorthand'; cls: Shorthand }

const readMember = (cur: Cursor): Member => {
  if (cur.peek() === BACKSLASH) {
    cur.next()
    const esc = parseEscape(cur, true)
    if (esc.kind === 'shorthand') return { kind: 'shorthand', cls: esc.cls }
    if (esc.kind === 'char') return { kind: 'char', cp: esc.cp }
    throw new RegexError('word boundary not allowed in character class')
  }
  return { kind: 'char', cp: cur.next() as number }
}

const startsRange = (cur: Cursor, lo: Member): boolean =>
  lo.kind === 'char' && cur.peek() === DASH && cur.peek(1) !== undefined && cur.peek(1) !== RBRACKET

const pushRange = (items: ClassItem[], lo: Member, hi: Member): void => {
  if (lo.kind !== 'char') return
  if (hi.kind === 'shorthand') {
    items.push(
      { kind: 'char', cp: lo.cp },
      { kind: 'char', cp: DASH },
      { kind: 'shorthand', cls: hi.cls }
    )
    return
  }
  if (hi.cp < lo.cp) throw new RegexError('character class range out of order')
  items.push({ kind: 'range', lo: lo.cp, hi: hi.cp })
}

const pushMember = (items: ClassItem[], member: Member): void => {
  items.push(
    member.kind === 'char'
      ? { kind: 'char', cp: member.cp }
      : { kind: 'shorthand', cls: member.cls }
  )
}

/**
 * Parses a bracketed character class. The opening `[` must already be consumed;
 * on return the matching `]` has been consumed.
 *
 * @param cur - The pattern cursor.
 * @throws {RegexError} If the class is unterminated or a range is reversed.
 */
export const parseClass = (cur: Cursor): { negated: boolean; items: ClassItem[] } => {
  const negated = cur.eat(0x5e)
  const items: ClassItem[] = []
  let first = true
  for (;;) {
    const cp = cur.peek()
    if (cp === undefined) throw new RegexError('unterminated character class')
    if (cp === RBRACKET && !first) {
      cur.next()
      return { negated, items }
    }
    first = false
    const lo = readMember(cur)
    if (startsRange(cur, lo)) {
      cur.next()
      pushRange(items, lo, readMember(cur))
    } else {
      pushMember(items, lo)
    }
  }
}
