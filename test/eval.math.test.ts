import { describe, expect, it } from 'vitest'

import { runAst } from '../src/eval'
import { parse } from '../src/parser'
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
    expect(evalExpr('round', -1.5)).toEqual([-2]) // jq: round half away from zero → -2
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
    expect(evalExpr('isinfinite', Infinity)).toEqual([true])
    expect(evalExpr('infinite', null)).toEqual([Infinity])
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
  it('add', () => {
    expect(evalExpr('[1, 2, 3] | add')).toEqual([6])
    expect(evalExpr('["a", "b"] | add')).toEqual(['ab'])
    expect(evalExpr('[[1], [2]] | add')).toEqual([[1, 2]])
    expect(evalExpr('[] | add')).toEqual([null])
    expect(() => evalExpr('[1, "a"] | add')).toThrow()
  })

  describe('trig (0-arity)', () => {
    it('sin', () => {
      expect(evalExpr('sin', 0)).toEqual([0])
      // sin is bounded [-1, 1]; spot-check a known value within tolerance
      const [r] = evalExpr('sin', Math.PI / 2) as number[]
      expect(r).toBeCloseTo(1, 10)
    })
    it('cos', () => {
      expect(evalExpr('cos', 0)).toEqual([1])
      const [r] = evalExpr('cos', Math.PI) as number[]
      expect(r).toBeCloseTo(-1, 10)
    })
    it('tan', () => {
      expect(evalExpr('tan', 0)).toEqual([0])
    })
    it('asin', () => {
      expect(evalExpr('asin', 0)).toEqual([0])
      // domain error → null
      expect(evalExpr('asin', 2)).toEqual([null])
    })
    it('acos', () => {
      expect(evalExpr('acos', 1)).toEqual([0])
      expect(evalExpr('acos', -2)).toEqual([null])
    })
    it('atan', () => {
      expect(evalExpr('atan', 0)).toEqual([0])
    })
    it('rejects non-number', () => {
      expect(() => evalExpr('sin', 'x')).toThrow()
    })
  })

  describe('hyperbolic (0-arity)', () => {
    it('sinh', () => {
      expect(evalExpr('sinh', 0)).toEqual([0])
    })
    it('cosh', () => {
      expect(evalExpr('cosh', 0)).toEqual([1])
    })
    it('tanh', () => {
      expect(evalExpr('tanh', 0)).toEqual([0])
    })
    it('asinh', () => {
      expect(evalExpr('asinh', 0)).toEqual([0])
    })
    it('acosh', () => {
      expect(evalExpr('acosh', 1)).toEqual([0])
      // acosh(x) for x < 1 → NaN → null
      expect(evalExpr('acosh', 0.5)).toEqual([null])
    })
    it('atanh', () => {
      expect(evalExpr('atanh', 0)).toEqual([0])
    })
  })

  describe('exp/log (0-arity)', () => {
    it('exp', () => {
      expect(evalExpr('exp', 0)).toEqual([1])
    })
    it('expm1', () => {
      expect(evalExpr('expm1', 0)).toEqual([0])
    })
    it('exp2', () => {
      expect(evalExpr('exp2', 0)).toEqual([1])
      expect(evalExpr('exp2', 10)).toEqual([1024])
    })
    it('exp10', () => {
      expect(evalExpr('exp10', 0)).toEqual([1])
      expect(evalExpr('exp10', 3)).toEqual([1000])
    })
    it('log', () => {
      expect(evalExpr('log', 1)).toEqual([0])
      // log of negative → NaN → null
      expect(evalExpr('log', -1)).toEqual([null])
    })
    it('log2', () => {
      expect(evalExpr('log2', 1)).toEqual([0])
      expect(evalExpr('log2', 8)).toEqual([3])
    })
    it('log10', () => {
      expect(evalExpr('log10', 1)).toEqual([0])
      expect(evalExpr('log10', 1000)).toEqual([3])
    })
    it('log1p', () => {
      expect(evalExpr('log1p', 0)).toEqual([0])
    })
    it('cbrt', () => {
      expect(evalExpr('cbrt', 0)).toEqual([0])
      expect(evalExpr('cbrt', 1)).toEqual([1])
      expect(evalExpr('cbrt', 8)).toEqual([2])
    })
  })

  describe('2-arity math', () => {
    it('pow', () => {
      expect(evalExpr('pow(2;10)')).toEqual([1024])
      expect(evalExpr('pow(10;3)')).toEqual([1000])
      expect(evalExpr('pow(2;0)')).toEqual([1])
      // Cartesian product: pow(2,3; 10)
      expect(evalExpr('pow(2,3; 10)')).toEqual([1024, 59049])
    })
    it('hypot', () => {
      expect(evalExpr('hypot(3;4)')).toEqual([5])
      expect(evalExpr('hypot(0;5)')).toEqual([5])
    })
    it('atan2', () => {
      expect(evalExpr('atan2(0;1)')).toEqual([0])
      // atan2(1;0) = pi/2
      const [r] = evalExpr('atan2(1;0)') as number[]
      expect(r).toBeCloseTo(Math.PI / 2, 10)
    })
    it('fabs', () => {
      expect(evalExpr('fabs', -5)).toEqual([5])
      expect(evalExpr('fabs', 3)).toEqual([3])
    })
    it('trunc', () => {
      expect(evalExpr('trunc', 3.7)).toEqual([3])
      expect(evalExpr('trunc', -3.7)).toEqual([-3])
    })
    it('fmin', () => {
      expect(evalExpr('fmin(2;5)')).toEqual([2])
      expect(evalExpr('fmin(5;2)')).toEqual([2])
      // NaN operand → return the non-NaN
      expect(evalExpr('fmin(nan; 3)')).toEqual([3])
    })
    it('fmax', () => {
      expect(evalExpr('fmax(2;5)')).toEqual([5])
      expect(evalExpr('fmax(nan; 3)')).toEqual([3])
    })
    it('fmod', () => {
      expect(evalExpr('fmod(10;3)')).toEqual([1])
      expect(evalExpr('fmod(-7;3)')).toEqual([-1])
    })
    it('copysign', () => {
      expect(evalExpr('copysign(5;-1)')).toEqual([-5])
      expect(evalExpr('copysign(5;1)')).toEqual([5])
      expect(evalExpr('copysign(-3;1)')).toEqual([3])
    })
    it('fdim', () => {
      expect(evalExpr('fdim(5;3)')).toEqual([2])
      expect(evalExpr('fdim(3;5)')).toEqual([0])
      expect(evalExpr('fdim(-1;-3)')).toEqual([2])
    })
    it('rejects non-number args', () => {
      expect(() => evalExpr('pow("a"; 2)')).toThrow()
      expect(() => evalExpr('pow(2; "b")')).toThrow()
    })
  })
})
