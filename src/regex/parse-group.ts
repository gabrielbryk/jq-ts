import type { RegexNode } from './ast'
import type { Cursor } from './cursor'
import { RegexError } from './errors'
import { readGroupName } from './parse-util'

const RPAREN = 0x29

/** Collaborators the group parser needs from the main {@link "./parse"} loop. */
export interface GroupContext {
  cur: Cursor
  /** Parses a full alternation (recurses back into the main parser). */
  parseAlt: () => RegexNode
  /** Allocates the next capture index, recording its (optional) name. */
  registerCapture: (name: string | null) => number
  /** Consumes `cp` or throws `message`. */
  expect: (cp: number, message: string) => void
}

const closeGroup = (ctx: GroupContext, capture: number | null, name: string | null): RegexNode => {
  const node = ctx.parseAlt()
  ctx.expect(RPAREN, 'unclosed group')
  return { type: 'Group', node, capture, name }
}

const namedOrLookbehind = (ctx: GroupContext): RegexNode => {
  ctx.cur.next() // '<'
  const d = ctx.cur.peek()
  if (d === 0x3d || d === 0x21) throw new RegexError('unsupported feature: lookbehind')
  const name = readGroupName(ctx.cur)
  return closeGroup(ctx, ctx.registerCapture(name), name)
}

const specialGroup = (ctx: GroupContext): RegexNode => {
  const c = ctx.cur.peek()
  if (c === 0x3a) {
    ctx.cur.next() // ':'
    return closeGroup(ctx, null, null)
  }
  if (c === 0x3d || c === 0x21) throw new RegexError('unsupported feature: lookahead')
  if (c === 0x3e) throw new RegexError('unsupported feature: atomic group')
  if (c === 0x3c) return namedOrLookbehind(ctx)
  throw new RegexError('unsupported group construct')
}

/**
 * Parses a group after its opening `(` has been consumed: a plain capturing
 * group, a named group `(?<name>...)`, or a non-capturing group `(?:...)`.
 * Rejects lookaround and atomic groups.
 */
export const parseGroup = (ctx: GroupContext): RegexNode => {
  if (ctx.cur.peek() === 0x3f) {
    ctx.cur.next() // '?'
    return specialGroup(ctx)
  }
  return closeGroup(ctx, ctx.registerCapture(null), null)
}
