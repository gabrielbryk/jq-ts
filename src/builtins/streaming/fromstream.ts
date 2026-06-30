import { RuntimeError } from '../../errors'
import { ensurePath, updatePath } from '../../path'
import type { Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

/**
 * `fromstream(f)`: consume the stream produced by `f` and reassemble the
 * original values, emitting each top-level value once it is complete.
 *
 * Mirrors jq's stateful `foreach` definition: a `[path, leaf]` event sets the
 * value at `path` (and flushes when `path` is empty, i.e. a top-level scalar);
 * a `[path]` close event flushes when `path` has length 1 (a top-level
 * container completed). After a flush the accumulator is reset.
 */
export const fromstreamBuiltins: BuiltinSpec[] = [
  {
    name: 'fromstream',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      let acc: Value = null
      let flush = false
      for (const event of evaluate(args[0]!, input, env, tracker)) {
        if (flush) {
          acc = null
          flush = false
        }
        if (!Array.isArray(event)) {
          throw new RuntimeError('fromstream: stream events must be arrays', span)
        }
        const path = ensurePath(event[0] ?? null, span)
        if (event.length === 2) {
          const leaf = event[1]!
          flush = path.length === 0
          acc = updatePath(acc, path, () => leaf, span) ?? null
        } else {
          flush = path.length === 1
        }
        if (flush) yield emit(acc, span, tracker)
      }
    },
  },
]
