import type { FieldAccessNode, IndexAccessNode, IterateNode, SliceNode } from '../../ast'
import { RuntimeError } from '../../errors'
import { getPath, type PathSegment } from '../../path'
import type { PathContext } from './internal'

/** `.field` — append the literal field name to each parent path. */
export function* fieldAccess(node: FieldAccessNode, ctx: PathContext): Generator<PathSegment[]> {
  const { input, env, tracker, evaluate, recurse } = ctx
  for (const parent of recurse(node.target, input, env, tracker, evaluate)) {
    yield [...parent, node.field]
  }
}

/** `.[expr]` — append each computed string/integer key to each parent path. */
export function* indexAccess(node: IndexAccessNode, ctx: PathContext): Generator<PathSegment[]> {
  const { input, env, tracker, evaluate, recurse } = ctx
  const parentPaths = Array.from(recurse(node.target, input, env, tracker, evaluate))
  const output = evaluate(node.index, input, env, tracker)
  for (const keyVal of output) {
    let key: string | number
    if (typeof keyVal === 'string') key = keyVal
    else if (typeof keyVal === 'number' && Number.isInteger(keyVal)) key = keyVal
    else throw new RuntimeError('Path index must be string or integer', node.span)

    for (const parent of parentPaths) {
      yield [...parent, key]
    }
  }
}

/** `.[]` — enumerate array indices / object keys under each parent path. */
export function* iterate(node: IterateNode, ctx: PathContext): Generator<PathSegment[]> {
  const { input, env, tracker, evaluate, recurse } = ctx
  const parentPaths = Array.from(recurse(node.target, input, env, tracker, evaluate))
  for (const p of parentPaths) {
    const val = getPath(input, p)
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        yield [...p, i]
      }
    } else if (val !== null && typeof val === 'object') {
      // Object
      for (const key of Object.keys(val)) {
        yield [...p, key]
      }
    } else {
      // Iterate on null is empty, others error?
      if (val === null) continue
      throw new RuntimeError(`Cannot iterate over ${typeof val}`, node.span)
    }
  }
}

/** `.[start:end]` — append a slice spec to each parent path. */
export function* slice(node: SliceNode, ctx: PathContext): Generator<PathSegment[]> {
  const { input, env, tracker, evaluate, recurse } = ctx
  const parentPaths = Array.from(recurse(node.target, input, env, tracker, evaluate))
  const startRes = node.start ? Array.from(evaluate(node.start, input, env, tracker)) : [null]
  const endRes = node.end ? Array.from(evaluate(node.end, input, env, tracker)) : [null]

  for (const startVal of startRes) {
    for (const endVal of endRes) {
      const sliceSpec: PathSegment = {
        start: typeof startVal === 'number' ? startVal : null,
        end: typeof endVal === 'number' ? endVal : null,
      }
      for (const p of parentPaths) {
        yield [...p, sliceSpec]
      }
    }
  }
}
