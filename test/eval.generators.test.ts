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

describe('generators', () => {
  describe('range', () => {
    it('range(end)', () => {
      expect(evalExpr('range(3)')).toEqual([0, 1, 2])
      expect(evalExpr('range(0)')).toEqual([])
      expect(evalExpr('range(-1)')).toEqual([])
    })
    it('range(start; end)', () => {
      expect(evalExpr('range(1; 4)')).toEqual([1, 2, 3])
      expect(evalExpr('range(2; 2)')).toEqual([])
      expect(evalExpr('range(5; 2)')).toEqual([])
    })
    it('range(start; end; step)', () => {
      expect(evalExpr('range(0; 6; 2)')).toEqual([0, 2, 4])
      expect(evalExpr('range(0; 5; 2)')).toEqual([0, 2, 4])
      expect(evalExpr('range(3; 0; -1)')).toEqual([3, 2, 1])
    })
    it('step cannot be 0', () => {
      expect(() => evalExpr('range(1; 5; 0)')).toThrow('range step cannot be zero')
    })
  })
})

describe('iterators', () => {
  describe('limit', () => {
    it('limits output', () => {
      expect(evalExpr('limit(2; range(5))')).toEqual([0, 1])
    })
    it('handles n <= 0', () => {
      expect(evalExpr('limit(0; range(5))')).toEqual([])
      expect(evalExpr('limit(-1; range(5))')).toEqual([])
    })
    it('evaluates expr lazily-ish', () => {
      // Using error to prove it stops
      // limit(1; (1, error("fail"))) -> should yield 1 and stop before error?
      // "Evaluates expr lazily" means generator stops.
      // Our runAst runs the generator.
      expect(evalExpr('limit(1; (1, error("fail")))')).toEqual([1])
    })
  })

  it('first', () => {
    expect(evalExpr('first(range(5))')).toEqual([0])
    expect(evalExpr('first(empty)')).toEqual([])
  })

  it('last', () => {
    expect(evalExpr('last(range(3))')).toEqual([2])
    expect(evalExpr('last(empty)')).toEqual([])
  })

  it('nth', () => {
    expect(evalExpr('nth(1; range(4))')).toEqual([1])
    expect(evalExpr('nth(5; range(4))')).toEqual([])
    expect(evalExpr('nth(0; range(4))')).toEqual([0])
  })

  it('isempty', () => {
    expect(evalExpr('isempty(empty)')).toEqual([true])
    expect(evalExpr('isempty(1)')).toEqual([false])
    expect(evalExpr('isempty(range(2))')).toEqual([false])
  })
})

describe('aggregators', () => {
  it('all', () => {
    expect(evalExpr('all((true, true))')).toEqual([true])
    expect(evalExpr('all((true, false))')).toEqual([false])
    expect(evalExpr('all(empty)')).toEqual([true])
  })
  it('any', () => {
    expect(evalExpr('any((false, false))')).toEqual([false])
    expect(evalExpr('any((false, true))')).toEqual([true])
    expect(evalExpr('any(empty)')).toEqual([false])
  })
})
