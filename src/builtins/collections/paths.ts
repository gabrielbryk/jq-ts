import { evaluatePath } from '../../eval/pathEval'
import { deletePaths, getPath, updatePath } from '../../path'
import type { Value } from '../../value'
import { checkContains } from '../strings'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const pathBuiltins: BuiltinSpec[] = [
  {
    name: 'del',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const paths = Array.from(evaluatePath(args[0]!, input, env, tracker, evaluate))
      yield emit(deletePaths(input, paths, span), span, tracker)
    },
  },
  {
    name: 'pick',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const paths = Array.from(evaluatePath(args[0]!, input, env, tracker, evaluate))
      let result: Value = null
      for (const path of paths) {
        const value = getPath(input, path)
        result = updatePath(result, path, () => value ?? null, span) ?? null
      }
      yield emit(result, span, tracker)
    },
  },
  {
    name: 'inside',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const bGen = evaluate(args[0]!, input, env, tracker)
      for (const b of bGen) {
        yield emit(checkContains(b, input), span, tracker)
      }
    },
  },
]
