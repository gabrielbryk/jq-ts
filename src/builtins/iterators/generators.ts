import { RuntimeError } from '../../errors'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const generatorBuiltins: BuiltinSpec[] = [
  {
    name: 'range',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // range(end): 0 to end
      const ends = evaluate(args[0]!, input, env, tracker)
      for (const end of ends) {
        if (typeof end !== 'number') throw new RuntimeError('range expects numbers', span)
        for (let i = 0; i < end; i++) {
          yield emit(i, span, tracker)
        }
      }
    },
  },
  {
    name: 'range',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // range(start; end): start to end (step 1)
      const starts = Array.from(evaluate(args[0]!, input, env, tracker))
      const ends = Array.from(evaluate(args[1]!, input, env, tracker))
      for (const start of starts) {
        for (const end of ends) {
          if (typeof start !== 'number' || typeof end !== 'number')
            throw new RuntimeError('range expects numbers', span)
          if (start < end) {
            for (let i = start; i < end; i++) {
              yield emit(i, span, tracker)
            }
          } else {
            // jq behavior: if start > end, range is empty (step defaults to 1)
          }
        }
      }
    },
  },
  {
    name: 'range',
    arity: 3,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // range(start; end; step)
      const starts = Array.from(evaluate(args[0]!, input, env, tracker))
      const ends = Array.from(evaluate(args[1]!, input, env, tracker))
      const steps = Array.from(evaluate(args[2]!, input, env, tracker))

      for (const start of starts) {
        for (const end of ends) {
          for (const step of steps) {
            if (typeof start !== 'number' || typeof end !== 'number' || typeof step !== 'number') {
              throw new RuntimeError('range expects numbers', span)
            }
            if (step === 0) throw new RuntimeError('range step cannot be zero', span)

            if (step > 0) {
              for (let i = start; i < end; i += step) {
                yield emit(i, span, tracker)
              }
            } else {
              for (let i = start; i > end; i += step) {
                yield emit(i, span, tracker)
              }
            }
          }
        }
      }
    },
  },
]
