import { describe, expect, it } from 'vitest'
import { parse } from '../src/parser'
import { validate } from '../src/validate'
import { runAst, type EvalOptions } from '../src/eval'
import type { Value } from '../src/value'

const evalExpr = (expr: string, input: Value = null, options?: EvalOptions) => {
  const ast = parse(expr)
  validate(ast)
  return runAst(ast, input, options)
}

describe('eval core semantics', () => {
  it('pipes values through sequences', () => {
    const result = evalExpr('(1,2) | (. + 1)')
    expect(result).toEqual([2, 3])
  })

  it('preserves input through as bindings', () => {
    const result = evalExpr('. as $x | ., $x', { foo: 1 })
    expect(result).toEqual([{ foo: 1 }, { foo: 1 }])
  })

  it('builds arrays by concatenating item outputs', () => {
    const result = evalExpr('[ (1,2), 3 ]')
    expect(result).toEqual([[1, 2, 3]])
  })

  it('builds objects via cartesian products of entry streams', () => {
    const result = evalExpr('{a: (1,2), b: (10,20)}')
    expect(result).toEqual([
      { a: 1, b: 10 },
      { a: 1, b: 20 },
      { a: 2, b: 10 },
      { a: 2, b: 20 },
    ])
  })
})
