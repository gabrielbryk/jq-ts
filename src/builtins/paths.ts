import { RuntimeError } from '../errors'
import { isPlainObject, type Value } from '../value'
import type { Span } from '../span'
import type { LimitTracker } from '../limits'
import type { BuiltinSpec } from './types'
import { ensurePath, getPath, updatePath, deletePaths } from '../path'
import { evaluatePath } from '../eval/pathEval'
import { emit } from './utils'

// --- Internal Path Logic ---

function* traversePaths(
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

// --- Builtin Exports ---

export const pathBuiltins: BuiltinSpec[] = [
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
