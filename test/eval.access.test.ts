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

describe('eval access', () => {
  describe('index access', () => {
    it('handles basic integer indexing', () => {
      expect(evalExpr('.[1]', [10, 20, 30])).toEqual([20])
      expect(evalExpr('.[-1]', [10, 20, 30])).toEqual([30])
    })

    it('handles float truncation (jq parity)', () => {
      expect(evalExpr('.[1.5]', [10, 20, 30])).toEqual([20])
      expect(evalExpr('.[-1.5]', [10, 20, 30])).toEqual([30]) // -1.5 truncates to -1
    })

    it('handles out of bounds and non-finite indices', () => {
      expect(evalExpr('.[99]', [10, 20])).toEqual([null])
      expect(evalExpr('.[1e20]', [10, 20])).toEqual([null])
      // NaN via variable
      expect(runAst(parse('.[$x]'), [10, 20], { vars: { x: NaN } })).toEqual([null])
    })

    it('errors on non-numeric array index', () => {
      expect(() => evalExpr('.["foo"]', [1, 2])).toThrow('Expected numeric index')
    })

    it('handles object indexing', () => {
      expect(evalExpr('.["a"]', { a: 1 })).toEqual([1])
      expect(evalExpr('.["b"]', { a: 1 })).toEqual([null])
    })
  })

  describe('field access', () => {
    it('handles basic field access', () => {
      expect(evalExpr('.a', { a: 1 })).toEqual([1])
      expect(evalExpr('.b', { a: 1 })).toEqual([null])
    })

    it('handles nested field access', () => {
      expect(evalExpr('.a.b', { a: { b: 2 } })).toEqual([2])
    })
  })

  describe('slice access', () => {
    it('handles basic slicing', () => {
      expect(evalExpr('.[0:2]', [10, 20, 30])).toEqual([[10, 20]])
    })

    it('handles open slices', () => {
      expect(evalExpr('.[1:]', [10, 20, 30])).toEqual([[20, 30]])
      expect(evalExpr('.[:2]', [10, 20, 30])).toEqual([[10, 20]])
    })
  })
})
