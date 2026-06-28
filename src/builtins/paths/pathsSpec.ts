import { ensurePath, getPath } from '../../path'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'
import { traversePaths } from './traverse'

export const pathsSpecs: BuiltinSpec[] = [
  {
    name: 'paths',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      yield* traversePaths(input, [], span, tracker)
    },
  },
  {
    name: 'paths',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      for (const pathVal of traversePaths(input, [], span, tracker)) {
        const path = ensurePath(pathVal, span)
        const value = getPath(input, path) ?? null
        let matched = false
        for (const result of evaluate(args[0]!, value, env, tracker)) {
          if (result !== null && result !== false) {
            matched = true
            break
          }
        }
        if (matched) yield emit(path, span, tracker)
      }
    },
  },
]
