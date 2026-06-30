import type { FilterNode } from '../../ast'
import { RuntimeError } from '../../errors'
import type { LimitTracker } from '../../limits'
import type { Span } from '../../span'
import { describeType, type Value } from '../../value'
import type { BuiltinSpec, Evaluator } from '../types'
import { emit } from '../utils'
import { captureObject, compile, requireStringInput, toCodepoints } from './core'

type EvalEnv = Parameters<Evaluator>[2]

/** State accumulator mirroring jq's `{result, previous}` reduction. */
interface SubState {
  result: string[]
  previous: number
}

const requireReplacement = (val: Value, span: Span): string => {
  if (typeof val !== 'string') {
    throw new RuntimeError(`${describeType(val)} cannot be used as a substitution`, span)
  }
  return val
}

/**
 * Applies jq's sub/gsub reduction: for each match, the replacement filter runs
 * once with the capture object as input, producing an array of inserts that are
 * zipped (by index) into the parallel result strings.
 */
const reduceMatches = (
  cps: string[],
  compiled: ReturnType<typeof compile>,
  global: boolean,
  repl: FilterNode,
  env: EvalEnv,
  tracker: LimitTracker,
  evaluate: Evaluator,
  span: Span
): SubState => {
  const state: SubState = { result: [], previous: 0 }
  const matches = global ? compiled.matchAll(cps.join('')) : firstMatch(compiled, cps)
  for (const edit of matches) {
    const gap = cps.slice(state.previous, edit.index).join('')
    const captures = captureObject(edit, cps, compiled.groupNames)
    const inserts = Array.from(evaluate(repl, captures, env, tracker), (v) =>
      requireReplacement(v, span)
    )
    for (let ix = 0; ix < inserts.length; ix++) {
      state.result[ix] = (state.result[ix] ?? '') + gap + inserts[ix]
    }
    state.previous = edit.index + edit.length
  }
  return state
}

const firstMatch = (compiled: ReturnType<typeof compile>, cps: string[]) => {
  const m = compiled.exec(cps.join(''))
  return m === null ? [] : [m]
}

/** Builds a `sub`/`gsub` builtin; `forceGlobal` appends `g` like jq's gsub. */
const subBuiltin = (arity: number, forceGlobal: boolean): BuiltinSpec => ({
  name: forceGlobal ? 'gsub' : 'sub',
  arity,
  apply: function* (input, args, env, tracker, evaluate, span) {
    const str = requireStringInput(input, span)
    const cps = toCodepoints(str)
    const flagsArg = arity === 3 ? args[2]! : null
    for (const re of evaluate(args[0]!, input, env, tracker)) {
      const flagsValues = flagsArg ? evaluate(flagsArg, input, env, tracker) : [null]
      for (const rawFlags of flagsValues) {
        const flags = (typeof rawFlags === 'string' ? rawFlags : '') + (forceGlobal ? 'g' : '')
        const compiled = compile(re, flags, span)
        const { result, previous } = reduceMatches(
          cps,
          compiled,
          flags.includes('g'),
          args[1]!,
          env,
          tracker,
          evaluate,
          span
        )
        const tail = cps.slice(previous).join('')
        if (result.length === 0) yield emit(str, span, tracker)
        else for (const piece of result) yield emit(piece + tail, span, tracker)
      }
    }
  },
})

export const subBuiltins: BuiltinSpec[] = [
  subBuiltin(2, false),
  subBuiltin(3, false),
  subBuiltin(2, true),
  subBuiltin(3, true),
]
