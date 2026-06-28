import type { LimitTracker } from '../../limits'
import type { Span } from '../../span'
import { isPlainObject, type Value } from '../../value'
import { emit } from '../utils'

export function* traversePaths(
  root: Value,
  currentPath: (string | number)[],
  span: Span,
  tracker: LimitTracker
): Generator<Value> {
  tracker.step(span)
  if (Array.isArray(root)) {
    for (let i = 0; i < root.length; i++) {
      const path = [...currentPath, i]
      yield emit(path, span, tracker)
      yield* traversePaths(root[i]!, path, span, tracker)
    }
  } else if (isPlainObject(root)) {
    const keys = Object.keys(root).sort()
    for (const key of keys) {
      const path = [...currentPath, key]
      yield emit(path, span, tracker)
      yield* traversePaths(root[key]!, path, span, tracker)
    }
  }
}
