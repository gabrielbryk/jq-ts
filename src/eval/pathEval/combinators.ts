import type { CallNode, CommaNode, PipeNode, TryNode } from '../../ast'
import { RuntimeError } from '../../errors'
import { getPath, type PathSegment } from '../../path'
import type { PathContext } from './internal'

/**
 * `.a | .b` — resolve the left paths, then for each resulting value resolve the
 * right paths against it and concatenate.
 */
export function* pipe(node: PipeNode, ctx: PathContext): Generator<PathSegment[]> {
  // For .a | .b
  // 1. Get paths of left (.a)
  // 2. For each path p, get value v = getPath(input, p)
  // 3. Get paths of right (.b) against v -> q
  // 4. Yield [...p, ...q]
  const { input, env, tracker, evaluate, recurse } = ctx
  const leftPaths = Array.from(recurse(node.left, input, env, tracker, evaluate))
  for (const p of leftPaths) {
    const val = getPath(input, p) ?? null
    for (const q of recurse(node.right, val, env, tracker, evaluate)) {
      yield [...p, ...q]
    }
  }
}

/** `.a, .b` — concatenate the path streams of both branches. */
export function* comma(node: CommaNode, ctx: PathContext): Generator<PathSegment[]> {
  const { input, env, tracker, evaluate, recurse } = ctx
  yield* recurse(node.left, input, env, tracker, evaluate)
  yield* recurse(node.right, input, env, tracker, evaluate)
}

/** `try f` — swallow runtime errors raised while resolving the body's paths. */
export function* tryPath(node: TryNode, ctx: PathContext): Generator<PathSegment[]> {
  const { input, env, tracker, evaluate, recurse } = ctx
  try {
    yield* recurse(node.body, input, env, tracker, evaluate)
  } catch (e) {
    if (!(e instanceof RuntimeError)) throw e
  }
}

/**
 * Function calls in path position. Only `select(cond)` is valid: it yields the
 * identity path when the condition is truthy, otherwise nothing.
 */
export function* call(node: CallNode, ctx: PathContext): Generator<PathSegment[]> {
  if (node.name === 'select') {
    const { input, env, tracker, evaluate } = ctx
    const conds = evaluate(node.args[0]!, input, env, tracker)
    let matched = false
    for (const c of conds) {
      if (c !== null && c !== false) {
        matched = true // Truthy
      }
    }
    if (matched) yield [] // Relative path is empty (identity)
    return
  }
  throw new RuntimeError(`Function ${node.name} not supported in path expression`, node.span)
}
