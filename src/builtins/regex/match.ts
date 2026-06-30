import type { BuiltinSpec } from '../types'
import { emit } from '../utils'
import { resolveArgs } from './args'
import { compile, findMatches, isGlobal, requireStringInput, toCodepoints, toJqMatch } from './core'

/** `test(re)` / `test(re; flags)` -> boolean (true when the regex matches). */
const testBuiltin = (arity: number): BuiltinSpec => ({
  name: 'test',
  arity,
  apply: function* (input, args, env, tracker, evaluate, span) {
    const str = requireStringInput(input, span)
    for (const { re, flags } of resolveArgs(args, input, env, tracker, evaluate, span)) {
      const compiled = compile(re, flags, span)
      yield emit(compiled.exec(str) !== null, span, tracker)
    }
  },
})

/** `match(re)` / `match(re; flags)` -> one match object per match. */
const matchBuiltin = (arity: number): BuiltinSpec => ({
  name: 'match',
  arity,
  apply: function* (input, args, env, tracker, evaluate, span) {
    const str = requireStringInput(input, span)
    const cps = toCodepoints(str)
    for (const { re, flags } of resolveArgs(args, input, env, tracker, evaluate, span)) {
      const compiled = compile(re, flags, span)
      for (const m of findMatches(compiled, str, isGlobal(flags))) {
        yield emit(toJqMatch(m, cps, compiled.groupNames), span, tracker)
      }
    }
  },
})

export const matchBuiltins: BuiltinSpec[] = [
  testBuiltin(1),
  testBuiltin(2),
  matchBuiltin(1),
  matchBuiltin(2),
]
