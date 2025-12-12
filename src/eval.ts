import type { FilterNode, ObjectKey } from './ast'
import { RuntimeError } from './errors'
import { LimitTracker, resolveLimits, type LimitsConfig } from './limits'
import type { Span } from './span'
import { isTruthy, valueEquals, compareValues, type Value } from './value'
import { builtins } from './builtins'

export type EnvFrame = Map<string, Value>
export type EnvStack = EnvFrame[]

export interface EvalOptions {
  limits?: LimitsConfig
}

export const runAst = (ast: FilterNode, input: Value, options: EvalOptions = {}): Value[] => {
  const tracker = new LimitTracker(resolveLimits(options.limits))
  const env: EnvStack = [new Map<string, Value>()]
  return Array.from<Value>(evaluate(ast, input, env, tracker))
}

/**
 * Evaluates an AST node against an input value.
 * This is a generator function that yields results lazily.
 *
 * @param node - The AST node to evaluate.
 * @param input - The current input value (context).
 * @param env - The variable environment stack.
 * @param tracker - Limits tracker for cycle/output limits.
 */
function* evaluate(
  node: FilterNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
): Generator<Value, void, undefined> {
  tracker.step(node.span)
  tracker.enter(node.span)
  try {
    switch (node.kind) {
      case 'Identity':
        yield emit(input, node.span, tracker)
        return
      case 'Literal':
        yield emit(node.value, node.span, tracker)
        return
      case 'Var':
        yield emit(getVar(env, node.name, node.span), node.span, tracker)
        return
      case 'FieldAccess':
        yield* evalField(node, input, env, tracker)
        return
      case 'IndexAccess':
        yield* evalIndex(node, input, env, tracker)
        return
      case 'Array':
        yield emit(buildArray(node, input, env, tracker), node.span, tracker)
        return
      case 'Object':
        yield* buildObjects(node, input, env, tracker)
        return
      case 'Pipe':
        for (const left of evaluate(node.left, input, env, tracker)) {
          yield* evaluate(node.right, left, env, tracker)
        }
        return
      case 'Comma':
        yield* evaluate(node.left, input, env, tracker)
        yield* evaluate(node.right, input, env, tracker)
        return
      case 'Alt': {
        const leftValues = Array.from<Value>(evaluate(node.left, input, env, tracker))
        const valid = leftValues.filter((v) => v !== null && v !== false)
        if (valid.length > 0) {
          for (const v of valid) {
            yield v
          }
        } else {
          yield* evaluate(node.right, input, env, tracker)
        }
        return
      }
      case 'Unary':
        if (node.op === 'Not') {
          for (const value of evaluate(node.expr, input, env, tracker)) {
            yield emit(!isTruthy(value), node.span, tracker)
          }
        } else {
          for (const value of evaluate(node.expr, input, env, tracker)) {
            yield emit(applyUnaryNeg(value, node.span), node.span, tracker)
          }
        }
        return
      case 'Binary':
        yield* evalBinary(node, input, env, tracker)
        return
      case 'Bool':
        if (node.op === 'Or') {
          for (const left of evaluate(node.left, input, env, tracker)) {
            if (isTruthy(left)) {
              yield emit(true, node.span, tracker)
            } else {
              for (const right of evaluate(node.right, input, env, tracker)) {
                yield emit(isTruthy(right), node.span, tracker)
              }
            }
          }
        } else {
          for (const left of evaluate(node.left, input, env, tracker)) {
            if (!isTruthy(left)) {
              yield emit(false, node.span, tracker)
            } else {
              for (const right of evaluate(node.right, input, env, tracker)) {
                yield emit(isTruthy(right), node.span, tracker)
              }
            }
          }
        }
        return
      case 'If':
        for (const branch of node.branches) {
          const condValues = Array.from<Value>(evaluate(branch.cond, input, env, tracker))
          if (condValues.length > 1) {
            throw new RuntimeError('Condition produced multiple values', branch.cond.span)
          }
          if (condValues.length === 1 && isTruthy(condValues[0]!)) {
            yield* evaluate(branch.then, input, env, tracker)
            return
          }
        }
        yield* evaluate(node.else, input, env, tracker)
        return
      case 'As': {
        const boundValues = Array.from<Value>(evaluate(node.bind, input, env, tracker))
        for (const value of boundValues) {
          pushBinding(env, node.name, value)
          try {
            yield* evaluate(node.body, input, env, tracker)
          } finally {
            popBinding(env)
          }
        }
        return
      }
      case 'Call': {
        const builtin = builtins[node.name]
        if (!builtin) {
          throw new RuntimeError(`Unknown function: ${node.name}/${node.args.length}`, node.span)
        }
        yield* builtin.apply(input, node.args, env, tracker, evaluate, node.span)
        return
      }
      case 'Reduce':
        yield* evalReduce(node, input, env, tracker)
        return
      case 'Foreach':
        yield* evalForeach(node, input, env, tracker)
        return
      case 'Try':
        yield* evalTry(node, input, env, tracker)
        return
      case 'Recurse':
        yield* evalRecurse(node, input, env, tracker)
        return
      case 'Iterate':
        yield* evalIterate(node, input, env, tracker)
        return
    }
  } finally {
    tracker.exit()
  }
}

const emit = (value: Value, span: Span, tracker: LimitTracker): Value => {
  tracker.emit(span)
  return value
}

const evalField = function* (
  node: Extract<FilterNode, { kind: 'FieldAccess' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
): Generator<Value> {
  for (const container of evaluate(node.target, input, env, tracker)) {
    if (container === null) {
      yield emit(null, node.span, tracker)
      continue
    }
    if (isPlainObject(container)) {
      yield emit(
        Object.prototype.hasOwnProperty.call(container, node.field) ? container[node.field]! : null,
        node.span,
        tracker
      )
      continue
    }
    throw new RuntimeError(`Cannot index ${describeType(container)} with string`, node.span)
  }
}

const evalIndex = function* (
  node: Extract<FilterNode, { kind: 'IndexAccess' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
): Generator<Value> {
  const indexValues = Array.from<Value>(evaluate(node.index, input, env, tracker))
  for (const container of evaluate(node.target, input, env, tracker)) {
    if (container === null) {
      yield emit(null, node.span, tracker)
      continue
    }
    if (isValueArray(container)) {
      for (const idxValue of indexValues) {
        const index = ensureInteger(idxValue, node.span)
        const resolved = index < 0 ? container.length + index : index
        if (resolved < 0 || resolved >= container.length) {
          yield emit(null, node.span, tracker)
        } else {
          yield emit(container[resolved]!, node.span, tracker)
        }
      }
      continue
    }
    if (isPlainObject(container)) {
      for (const keyValue of indexValues) {
        if (typeof keyValue !== 'string') {
          throw new RuntimeError(`Cannot index object with ${describeType(keyValue)}`, node.span)
        }
        yield emit(
          Object.prototype.hasOwnProperty.call(container, keyValue) ? container[keyValue]! : null,
          node.span,
          tracker
        )
      }
      continue
    }
    throw new RuntimeError(`Cannot index ${describeType(container)}`, node.span)
  }
}

const evalIterate = function* (
  node: Extract<FilterNode, { kind: 'Iterate' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
): Generator<Value> {
  for (const container of evaluate(node.target, input, env, tracker)) {
    if (container === null) {
      // jq null | .[] outputs nothing
      continue
    }
    if (isValueArray(container)) {
      for (const item of container) {
        yield emit(item, node.span, tracker)
      }
      continue
    }
    if (isPlainObject(container)) {
      const keys = Object.keys(container).sort()
      for (const key of keys) {
        yield emit(container[key]!, node.span, tracker)
      }
      continue
    }
    throw new RuntimeError(`Cannot iterate over ${describeType(container)}`, node.span)
  }
}

const evalReduce = function* (
  node: Extract<FilterNode, { kind: 'Reduce' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
): Generator<Value> {
  const initValues = Array.from(evaluate(node.init, input, env, tracker))
  if (initValues.length !== 1) {
    throw new RuntimeError('Reduce init must single value', node.init.span)
  }
  let acc = initValues[0]!

  for (const item of evaluate(node.source, input, env, tracker)) {
    tracker.step(node.span)
    pushBinding(env, node.var, item)
    try {
      const updates = Array.from(evaluate(node.update, acc, env, tracker))
      if (updates.length !== 1) {
        throw new RuntimeError('Reduce update must produce single value', node.update.span)
      }
      acc = updates[0]!
    } finally {
      popBinding(env)
    }
  }
  yield emit(acc, node.span, tracker)
}

const evalForeach = function* (
  node: Extract<FilterNode, { kind: 'Foreach' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
): Generator<Value> {
  const initValues = Array.from(evaluate(node.init, input, env, tracker))
  if (initValues.length !== 1) {
    throw new RuntimeError('Foreach init must single value', node.init.span)
  }
  let acc = initValues[0]!

  for (const item of evaluate(node.source, input, env, tracker)) {
    tracker.step(node.span)
    pushBinding(env, node.var, item)
    try {
      const updates = Array.from(evaluate(node.update, acc, env, tracker))
      if (updates.length !== 1) {
        throw new RuntimeError('Foreach update must produce single value', node.update.span)
      }
      acc = updates[0]!

      if (node.extract) {
        for (const extracted of evaluate(node.extract, acc, env, tracker)) {
          yield emit(extracted, node.span, tracker)
        }
      } else {
        yield emit(acc, node.span, tracker)
      }
    } finally {
      popBinding(env)
    }
  }
}

const evalTry = function* (
  node: Extract<FilterNode, { kind: 'Try' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
): Generator<Value> {
  try {
    yield* evaluate(node.body, input, env, tracker)
  } catch (err) {
    if (err instanceof RuntimeError) {
      if (node.handler) {
        // Bind error message to input
        yield* evaluate(node.handler, err.message, env, tracker)
      }
      // If no handler, suppress error (emit nothing)
    } else {
      throw err
    }
  }
}

const evalRecurse = function* (
  node: Extract<FilterNode, { kind: 'Recurse' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
): Generator<Value> {
  yield emit(input, node.span, tracker)
  tracker.step(node.span)

  if (isValueArray(input)) {
    for (const item of input) {
      yield* evaluate(node, item, env, tracker)
    }
  } else if (isPlainObject(input)) {
    const keys = Object.keys(input).sort()
    for (const key of keys) {
      yield* evaluate(node, input[key]!, env, tracker)
    }
  }
}

const buildArray = (
  node: Extract<FilterNode, { kind: 'Array' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
): Value[] => {
  const result: Value[] = []
  node.items.forEach((item) => {
    for (const value of evaluate(item, input, env, tracker)) {
      result.push(value)
    }
  })
  return result
}

const buildObjects = function* (
  node: Extract<FilterNode, { kind: 'Object' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
): Generator<Value> {
  if (node.entries.length === 0) {
    yield emit({}, node.span, tracker)
    return
  }

  let partials: Record<string, Value>[] = [{}]
  for (const entry of node.entries) {
    const keys = resolveObjectKeys(entry.key, input, env, tracker)
    const values = Array.from<Value>(evaluate(entry.value, input, env, tracker))
    const next: Record<string, Value>[] = []
    partials.forEach((partial) => {
      keys.forEach((key) => {
        values.forEach((value) => {
          next.push(extendRecord(partial, key, value))
        })
      })
    })
    partials = next
    if (partials.length === 0) {
      return
    }
  }
  for (const obj of partials) {
    yield emit(obj, node.span, tracker)
  }
}

const resolveObjectKeys = (
  key: ObjectKey,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
): string[] => {
  if (key.kind === 'KeyIdentifier') return [key.name]
  if (key.kind === 'KeyString') return [key.value]
  const values = Array.from<Value>(evaluate(key.expr, input, env, tracker))
  return values.map((value) => {
    if (typeof value !== 'string') {
      throw new RuntimeError('Object key expression must produce strings', key.span)
    }
    return value
  })
}

const evalBinary = function* (
  node: Extract<FilterNode, { kind: 'Binary' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
): Generator<Value> {
  const leftValues = Array.from<Value>(evaluate(node.left, input, env, tracker))
  const rightValues = Array.from<Value>(evaluate(node.right, input, env, tracker))
  for (const left of leftValues) {
    for (const right of rightValues) {
      yield emit(applyBinaryOp(node.op, left, right, node.span), node.span, tracker)
    }
  }
}

const applyBinaryOp = (op: string, left: Value, right: Value, span: Span): Value => {
  switch (op) {
    case '+':
      return applyPlus(left, right, span)
    case '-':
      return applyMinus(left, right, span)
    case '*':
      return applyMultiply(left, right, span)
    case '/':
      return applyDivide(left, right, span)
    case '%':
      return applyModulo(left, right, span)
    case 'Eq':
      return valueEquals(left, right)
    case 'Neq':
      return !valueEquals(left, right)
    case 'Lt':
      return compareValues(left, right) < 0
    case 'Lte':
      return compareValues(left, right) <= 0
    case 'Gt':
      return compareValues(left, right) > 0
    case 'Gte':
      return compareValues(left, right) >= 0
    default:
      throw new RuntimeError(`Unsupported operator ${op}`, span)
  }
}

const applyUnaryNeg = (value: Value, span: Span): Value => {
  if (typeof value === 'number') return -value
  throw new RuntimeError('Unary "-" expects a number', span)
}

const applyPlus = (left: Value, right: Value, span: Span): Value => {
  if (left === null) return cloneValue(right)
  if (right === null) return cloneValue(left)
  if (typeof left === 'number' && typeof right === 'number') return left + right
  if (typeof left === 'string' && typeof right === 'string') return left + right
  if (isValueArray(left) && isValueArray(right)) return [...left, ...right]
  if (isPlainObject(left) && isPlainObject(right)) return mergeShallowObjects(left, right)
  throw new RuntimeError(`Cannot add ${describeType(left)} and ${describeType(right)}`, span)
}

const applyMinus = (left: Value, right: Value, span: Span): Value => {
  if (typeof left === 'number' && typeof right === 'number') return left - right
  if (isValueArray(left) && isValueArray(right)) {
    return left.filter((item) => !right.some((candidate) => valueEquals(item, candidate)))
  }
  throw new RuntimeError(`Cannot subtract ${describeType(right)} from ${describeType(left)}`, span)
}

const applyMultiply = (left: Value, right: Value, span: Span): Value => {
  if (typeof left === 'number' && typeof right === 'number') return left * right
  if (typeof left === 'string' && typeof right === 'number') return repeatString(left, right, span)
  if (typeof right === 'string' && typeof left === 'number') return repeatString(right, left, span)
  if (isPlainObject(left) && isPlainObject(right)) return deepMergeObjects(left, right)
  throw new RuntimeError(`Cannot multiply ${describeType(left)} and ${describeType(right)}`, span)
}

const applyDivide = (left: Value, right: Value, span: Span): Value => {
  if (typeof left !== 'number' || typeof right !== 'number') {
    throw new RuntimeError('Division expects two numbers', span)
  }
  if (right === 0) throw new RuntimeError('Division by zero', span)
  return left / right
}

const applyModulo = (left: Value, right: Value, span: Span): Value => {
  if (typeof left !== 'number' || typeof right !== 'number') {
    throw new RuntimeError('Modulo expects two numbers', span)
  }
  if (right === 0) throw new RuntimeError('Modulo by zero', span)
  return left % right
}

const repeatString = (text: string, countValue: number, span: Span): string => {
  const count = ensureInteger(countValue, span)
  if (count < 0) throw new RuntimeError('String repeat expects non-negative count', span)
  return text.repeat(count)
}

const deepMergeObjects = (left: Record<string, Value>, right: Record<string, Value>): Value => {
  const result: Record<string, Value> = {}
  Object.keys(left).forEach((key) => {
    const leftValue = left[key]
    if (leftValue !== undefined) {
      result[key] = cloneValue(leftValue)
    }
  })
  Object.keys(right).forEach((key) => {
    const existing = result[key]
    const rightValue = right[key]
    if (rightValue === undefined) {
      return
    }
    if (existing !== undefined && isPlainObject(existing) && isPlainObject(rightValue)) {
      result[key] = deepMergeObjects(existing, rightValue)
    } else {
      result[key] = cloneValue(rightValue)
    }
  })
  return result
}

const cloneValue = (value: Value): Value => {
  if (isValueArray(value)) {
    return value.map((item) => cloneValue(item))
  }
  if (isPlainObject(value)) {
    const result: Record<string, Value> = {}
    Object.keys(value).forEach((key) => {
      const child = value[key]
      if (child !== undefined) {
        result[key] = cloneValue(child)
      }
    })
    return result
  }
  return value
}

const getVar = (env: EnvStack, name: string, span: Span): Value => {
  for (let i = env.length - 1; i >= 0; i -= 1) {
    const frame = env[i]
    if (frame && frame.has(name)) {
      return frame.get(name)!
    }
  }
  throw new RuntimeError(`Unbound variable: $${name}`, span)
}

const pushBinding = (env: EnvStack, name: string, value: Value) => {
  env.push(new Map<string, Value>([[name, value]]))
}

const popBinding = (env: EnvStack) => {
  env.pop()
}

const ensureInteger = (value: Value, span: Span): number => {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new RuntimeError('Index must be an integer number', span)
  }
  return value
}

const extendRecord = (
  base: Record<string, Value>,
  key: string,
  value: Value
): Record<string, Value> => {
  const next: Record<string, Value> = {}
  Object.keys(base).forEach((existingKey) => {
    const existingValue = base[existingKey]
    if (existingValue !== undefined) {
      next[existingKey] = existingValue
    }
  })
  next[key] = value
  return next
}

const mergeShallowObjects = (
  left: Record<string, Value>,
  right: Record<string, Value>
): Record<string, Value> => {
  const result: Record<string, Value> = {}
  Object.keys(left).forEach((key) => {
    const leftValue = left[key]
    if (leftValue !== undefined) {
      result[key] = leftValue
    }
  })
  Object.keys(right).forEach((key) => {
    const rightValue = right[key]
    if (rightValue !== undefined) {
      result[key] = rightValue
    }
  })
  return result
}

const isValueArray = (value: Value): value is Value[] => Array.isArray(value)

const isPlainObject = (value: Value): value is Record<string, Value> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const describeType = (value: Value): string => {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return 'string'
  if (Array.isArray(value)) return 'array'
  return 'object'
}
