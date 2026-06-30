import type { Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'
import { resolveArgs } from './args'
import { compile, requireStringInput, toCodepoints } from './core'

/** Computes the substrings between successive matches (always global). */
const piecesBetween = (cps: string[], compiled: ReturnType<typeof compile>): string[] => {
  const pieces: string[] = []
  let start = 0
  for (const m of compiled.matchAll(cps.join(''))) {
    pieces.push(cps.slice(start, m.index).join(''))
    start = m.index + m.length
  }
  pieces.push(cps.slice(start).join(''))
  return pieces
}

/** `splits(re)` / `splits(re; flags)` -> stream of the pieces between matches. */
const splitsBuiltin = (arity: number): BuiltinSpec => ({
  name: 'splits',
  arity,
  apply: function* (input, args, env, tracker, evaluate, span) {
    const str = requireStringInput(input, span)
    const cps = toCodepoints(str)
    for (const { re, flags } of resolveArgs(args, input, env, tracker, evaluate, span)) {
      const compiled = compile(re, flags, span)
      for (const piece of piecesBetween(cps, compiled)) yield emit(piece, span, tracker)
    }
  },
})

/** `split(re; flags)` -> array of the pieces between matches (regex split). */
const splitRegexBuiltin: BuiltinSpec = {
  name: 'split',
  arity: 2,
  apply: function* (input, args, env, tracker, evaluate, span) {
    const str = requireStringInput(input, span)
    const cps = toCodepoints(str)
    for (const { re, flags } of resolveArgs(args, input, env, tracker, evaluate, span)) {
      const compiled = compile(re, flags, span)
      yield emit(piecesBetween(cps, compiled) as Value, span, tracker)
    }
  },
}

export const splitBuiltins: BuiltinSpec[] = [splitsBuiltin(1), splitsBuiltin(2), splitRegexBuiltin]
