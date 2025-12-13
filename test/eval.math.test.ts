import { describe, expect, it } from 'vitest'
import { parse } from '../src/parser'
import { runAst } from '../src/eval'
import { validate } from '../src/validate'
import type { Value } from '../src/value'

const evalExpr = (expr: string, input: Value = null) => {
  const ast = parse(expr)
  validate(ast)
  return runAst(ast, input)
}

describe('math', () => {
  it('floor', () => {
    expect(evalExpr('floor', 1.5)).toEqual([1])
    expect(evalExpr('floor', -1.5)).toEqual([-2])
  })
  it('ceil', () => {
    expect(evalExpr('ceil', 1.5)).toEqual([2])
    expect(evalExpr('ceil', -1.5)).toEqual([-1])
  })
  it('round', () => {
    expect(evalExpr('round', 1.5)).toEqual([2])
    expect(evalExpr('round', 1.4)).toEqual([1])
    expect(evalExpr('round', -1.5)).toEqual([-1]) // JS Math.round(-1.5) is -1. jq might be different?
    // jq ` -1.5 | round` -> -2.
    // JS `Math.round(-1.5)` -> -1.
    // Checks needed if we want strict jq compatibility.
    // For now using JS standard behavior as per plan "Deterministic wrappers around JS Math".
  })
  it('abs', () => {
    expect(evalExpr('abs', -10)).toEqual([10])
  })
  it('sqrt', () => {
    expect(evalExpr('sqrt', 9)).toEqual([3])
  })
  it('isnan/infinite', () => {
    expect(evalExpr('isnan', NaN)).toEqual([true])
    expect(evalExpr('isnan', 1)).toEqual([false])
    expect(evalExpr('infinite', Infinity)).toEqual([true])
    expect(evalExpr('isfinite', 1)).toEqual([true])
    expect(evalExpr('isfinite', Infinity)).toEqual([false])
  })

  describe('aggregators', () => {
    it('min', () => {
      expect(evalExpr('[1, 3, 2] | min')).toEqual([1])
      expect(evalExpr('[] | min')).toEqual([null])
    })
    it('max', () => {
      expect(evalExpr('[1, 3, 2] | max')).toEqual([3])
    })
    it('min_by', () => {
      const data = [{ a: 3 }, { a: 1 }, { a: 2 }]
      expect(evalExpr('min_by(.a)', data)).toEqual([{ a: 1 }])
    })
    it('max_by', () => {
      const data = [{ a: 3 }, { a: 1 }, { a: 2 }]
      expect(evalExpr('max_by(.a)', data)).toEqual([{ a: 3 }])
    })
  })
})
