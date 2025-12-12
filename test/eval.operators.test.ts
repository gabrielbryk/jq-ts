import { describe, expect, it } from 'vitest'
import { parse } from '../src/parser'
import { validate } from '../src/validate'
import { runAst } from '../src/eval' // Keep this import as runAst is used
import type { Value } from '../src/value'

const evalExpr = (expr: string, input: Value = null) => {
  const ast = parse(expr)
  validate(ast)
  return runAst(ast, input)
}

describe('eval operators', () => {
  it('evaluates alternative operator', () => {
    expect(evalExpr('null // 1')).toEqual([1])
    expect(evalExpr('1 // 2')).toEqual([1])
  })

  it('handles boolean operators per value', () => {
    expect(evalExpr('false or 1')).toEqual([true])
    expect(evalExpr('true and 1')).toEqual([true])
    expect(evalExpr('false and 1')).toEqual([false])
  })

  it('supports arithmetic rules', () => {
    expect(evalExpr('1 + null')).toEqual([1])
    expect(evalExpr('"a" * 3')).toEqual(['aaa'])
    expect(evalExpr('[1,2,2,3] - [2]')).toEqual([[1, 3]])
    expect(evalExpr('{a:{x:1}} * {a:{y:2}, b:3}')).toEqual([{ a: { x: 1, y: 2 }, b: 3 }])
  })

  it('compares values with deterministic ordering', () => {
    expect(evalExpr('[1] < [1,0]')).toEqual([true])
    expect(evalExpr('{a:1} < {a:1, b:0}')).toEqual([true])
    expect(evalExpr('1 == 1')).toEqual([true])
    expect(evalExpr('1 != 2')).toEqual([true])
  })
})
