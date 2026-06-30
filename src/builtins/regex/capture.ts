import type { Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'
import { resolveArgs } from './args'
import {
  captureObject,
  compile,
  findMatches,
  isGlobal,
  requireStringInput,
  toCodepoints,
} from './core'

/** `capture(re)` / `capture(re; flags)` -> object of named-group captures. */
const captureBuiltin = (arity: number): BuiltinSpec => ({
  name: 'capture',
  arity,
  apply: function* (input, args, env, tracker, evaluate, span) {
    const str = requireStringInput(input, span)
    const cps = toCodepoints(str)
    for (const { re, flags } of resolveArgs(args, input, env, tracker, evaluate, span)) {
      const compiled = compile(re, flags, span)
      for (const m of findMatches(compiled, str, isGlobal(flags))) {
        yield emit(captureObject(m, cps, compiled.groupNames), span, tracker)
      }
    }
  },
})

/**
 * `scan(re)` / `scan(re; flags)` -> stream over all matches (global). Emits the
 * array of capture strings when the regex has groups, otherwise the matched
 * substring.
 */
const scanBuiltin = (arity: number): BuiltinSpec => ({
  name: 'scan',
  arity,
  apply: function* (input, args, env, tracker, evaluate, span) {
    const str = requireStringInput(input, span)
    const cps = toCodepoints(str)
    for (const { re, flags } of resolveArgs(args, input, env, tracker, evaluate, span)) {
      const compiled = compile(re, flags, span)
      for (const m of compiled.matchAll(str)) {
        const out: Value =
          m.captures.length > 0
            ? m.captures.map((cap) =>
                cap === null ? null : cps.slice(cap.index, cap.index + cap.length).join('')
              )
            : cps.slice(m.index, m.index + m.length).join('')
        yield emit(out, span, tracker)
      }
    }
  },
})

export const captureBuiltins: BuiltinSpec[] = [
  captureBuiltin(1),
  captureBuiltin(2),
  scanBuiltin(1),
  scanBuiltin(2),
]
