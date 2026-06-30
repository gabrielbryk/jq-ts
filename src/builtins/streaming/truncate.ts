import { RuntimeError } from '../../errors'
import type { Span } from '../../span'
import type { Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

/**
 * Drops the first `depth` path elements of a single stream `event`, returning
 * the rewritten event, or `undefined` when the path is not longer than `depth`
 * (in which case the event is filtered out). Matches jq's
 * `setpath([0]; .[0][depth:])` truncation.
 */
const truncateEvent = (event: Value, depth: number, span: Span): Value | undefined => {
  if (!Array.isArray(event)) {
    throw new RuntimeError('truncate_stream: stream events must be arrays', span)
  }
  const path = event[0]
  if (!Array.isArray(path)) {
    throw new RuntimeError('truncate_stream: event path must be an array', span)
  }
  if (path.length <= depth) return undefined
  return [path.slice(depth), ...event.slice(1)]
}

const asDepth = (value: Value, span: Span): number => {
  if (typeof value !== 'number') {
    throw new RuntimeError('truncate_stream: depth must be a number', span)
  }
  return Math.trunc(value)
}

export const truncateStreamBuiltins: BuiltinSpec[] = [
  {
    // jq 1.8.1's native form: depth comes from the input `.`, and `stream`
    // is evaluated against `null` (per jq's builtin definition).
    name: 'truncate_stream',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const depth = asDepth(input, span)
      for (const event of evaluate(args[0]!, null, env, tracker)) {
        const truncated = truncateEvent(event, depth, span)
        if (truncated !== undefined) yield emit(truncated, span, tracker)
      }
    },
  },
  {
    // Ergonomic two-argument form `truncate_stream(depth; stream)`. Not part of
    // jq 1.8.1, which only exposes `truncate_stream/1`; provided for callers
    // that want to pass depth explicitly. `stream` is evaluated against `.`.
    name: 'truncate_stream',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      for (const depthVal of evaluate(args[0]!, input, env, tracker)) {
        const depth = asDepth(depthVal, span)
        for (const event of evaluate(args[1]!, input, env, tracker)) {
          const truncated = truncateEvent(event, depth, span)
          if (truncated !== undefined) yield emit(truncated, span, tracker)
        }
      }
    },
  },
]
