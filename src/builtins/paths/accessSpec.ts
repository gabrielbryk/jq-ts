import { RuntimeError } from '../../errors'
import { evaluatePath } from '../../eval/pathEval'
import { deletePaths, ensurePath, getPath, updatePath } from '../../path'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const accessSpecs: BuiltinSpec[] = [
  {
    name: 'getpath',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      for (const pathVal of evaluate(args[0]!, input, env, tracker)) {
        const path = ensurePath(pathVal, span)
        const res = getPath(input, path)
        yield emit(res ?? null, span, tracker)
      }
    },
  },
  {
    name: 'setpath',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const paths = Array.from(evaluate(args[0]!, input, env, tracker))
      const values = Array.from(evaluate(args[1]!, input, env, tracker))
      for (const pathVal of paths) {
        const path = ensurePath(pathVal, span)
        for (const val of values) {
          const res = updatePath(input, path, () => val, span)
          yield emit(res ?? null, span, tracker)
        }
      }
    },
  },
  {
    name: 'delpaths',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      for (const pathsVal of evaluate(args[0]!, input, env, tracker)) {
        if (!Array.isArray(pathsVal))
          throw new RuntimeError('delpaths expects an array of paths', span)
        const paths = pathsVal.map((p) => ensurePath(p, span))
        const res = deletePaths(input, paths, span)
        yield emit(res, span, tracker)
      }
    },
  },
  {
    name: 'path',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // path(expr) returns the path array of the expression
      // We use evaluatePath logic
      for (const p of evaluatePath(args[0]!, input, env, tracker, evaluate)) {
        yield emit(p, span, tracker)
      }
    },
  },
]
