import type { ArrayNode, ObjectEntry, ObjectNode } from '../ast'
import { RuntimeError } from '../errors'
import type { LimitTracker } from '../limits'
import type { Value } from '../value'
import type { Evaluator } from '../builtins/types'
import type { EnvStack } from './types'

/**
 * constructs arrays from the input.
 *
 * `[.foo, .bar]` -> `[foo_val, bar_val]`
 * It computes the Cartesian product of all items in the array definition.
 *
 * @param node - The array definition AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const buildArray = function* (
  node: ArrayNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  const result: Value[] = []
  for (const itemNode of node.items) {
    for (const itemVal of evaluate(itemNode, input, env, tracker)) {
      result.push(itemVal)
    }
  }
  yield result
}

/**
 * constructs objects from the input.
 *
 * `{a: .foo, b: .bar}`
 * Computes the Cartesian product of all key-value pairs.
 *
 * @param node - The object definition AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const buildObjects = function* (
  node: ObjectNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  // Similar to array, cartesian product of all entries.
  const obj: Record<string, Value> = {}
  yield* fillObject(node.entries, 0, obj, input, env, tracker, evaluate)
}

function* fillObject(
  entries: ObjectEntry[],
  index: number,
  current: Record<string, Value>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  if (index >= entries.length) {
    yield { ...current }
    return
  }

  const entry = entries[index]!
  // Evaluate Key
  let keys: string[] = []

  if (entry.key.kind === 'KeyIdentifier') {
    keys = [entry.key.name]
  } else if (entry.key.kind === 'KeyString') {
    keys = [entry.key.value]
  } else {
    // KeyExpr
    for (const k of evaluate(entry.key.expr, input, env, tracker)) {
      if (typeof k !== 'string')
        throw new RuntimeError('Object key must be a string', entry.key.span)
      keys.push(k)
    }
  }

  // For each key, evaluate value
  // "The value is evaluated for EACH key."
  // `{ (("a","b")): (1,2) }` -> `{"a":1}`, `{"a":2}`, `{"b":1}`, `{"b":2}` ?
  // jq: `{("a","b"): (1,2)}` ->
  // {"a":1}
  // {"a":2}
  // {"b":1}
  // {"b":2}
  // So cartesian product of KEYS and VALUES for this entry, AND other entries.

  for (const key of keys) {
    for (const val of evaluate(entry.value, input, env, tracker)) {
      current[key] = val
      yield* fillObject(entries, index + 1, current, input, env, tracker, evaluate)
      delete current[key]
    }
  }
}
