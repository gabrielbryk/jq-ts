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

describe('eval builtins', () => {
  describe('simple builtins', () => {
    it('type', () => {
      expect(evalExpr('type', null)).toEqual(['null'])
      expect(evalExpr('type', true)).toEqual(['boolean'])
      expect(evalExpr('type', 123)).toEqual(['number'])
      expect(evalExpr('type', 's')).toEqual(['string'])
      expect(evalExpr('type', [])).toEqual(['array'])
      expect(evalExpr('type', {})).toEqual(['object'])
    })

    it('tostring', () => {
      expect(evalExpr('tostring', 123)).toEqual(['123'])
      expect(evalExpr('tostring', [1, 2])).toEqual(['[1,2]'])
      expect(evalExpr('tostring', { b: 2, a: 1 })).toEqual(['{"a":1,"b":2}']) // Stable
    })

    it('tonumber', () => {
      expect(evalExpr('tonumber', '123')).toEqual([123])
      expect(evalExpr('tonumber', '12.34')).toEqual([12.34])
      expect(() => evalExpr('tonumber', 'abc')).toThrow('Cannot convert string "abc" to number')
      expect(evalExpr('tonumber', 10)).toEqual([10])
    })

    it('length', () => {
      expect(evalExpr('length', 'abc')).toEqual([3])
      expect(evalExpr('length', [1, 2, 3])).toEqual([3])
      expect(evalExpr('length', { a: 1, b: 2 })).toEqual([2])
      expect(() => evalExpr('length', 123)).toThrow()
    })

    it('keys', () => {
      expect(evalExpr('keys', { b: 2, a: 1 })).toEqual([['a', 'b']])
      expect(evalExpr('keys', [10, 20])).toEqual([[0, 1]])
    })

    it('has', () => {
      expect(evalExpr('has("a")', { a: 1 })).toEqual([true])
      expect(evalExpr('has("b")', { a: 1 })).toEqual([false])
      expect(evalExpr('has(1)', ['a', 'b'])).toEqual([true])
      expect(evalExpr('has(2)', ['a', 'b'])).toEqual([false])
    })
  })

  describe('filter builtins', () => {
    it('map', () => {
      expect(evalExpr('map(.+1)', [1, 2, 3])).toEqual([[2, 3, 4]])
    })

    it('select', () => {
      expect(evalExpr('map(select(. > 1))', [1, 2, 3])).toEqual([[2, 3]])
      expect(evalExpr('((1,2,3) | select(. > 1))')).toEqual([2, 3])
    })

    it('sort', () => {
      expect(evalExpr('sort', [3, 1, 2])).toEqual([[1, 2, 3]])
      expect(evalExpr('sort', ['b', 'a'])).toEqual([['a', 'b']])
    })

    it('sort_by', () => {
      expect(evalExpr('sort_by(-.)', [1, 3, 2])).toEqual([[3, 2, 1]])
      const input = [{ a: 2 }, { a: 1 }, { a: 3 }]
      expect(evalExpr('sort_by(.a)', input)).toEqual([[{ a: 1 }, { a: 2 }, { a: 3 }]])
    })

    it('unique', () => {
      expect(evalExpr('unique', [1, 2, 1, 3, 2])).toEqual([[1, 2, 3]])
    })

    it('unique_by', () => {
      const input = [
        { id: 1, v: 10 },
        { id: 2, v: 20 },
        { id: 1, v: 30 },
      ]
      expect(evalExpr('unique_by(.id)', input)).toEqual([
        [
          { id: 1, v: 10 },
          { id: 2, v: 20 },
        ],
      ])
    })
  })

  describe('object/entry builtins', () => {
    it('to_entries', () => {
      expect(evalExpr('to_entries', { a: 1, b: 2 })).toEqual([
        [
          { key: 'a', value: 1 },
          { key: 'b', value: 2 },
        ],
      ])
      expect(evalExpr('to_entries', ['x'])).toEqual([[{ key: 0, value: 'x' }]])
    })

    it('from_entries', () => {
      expect(evalExpr('from_entries', [{ key: 'a', value: 1 }])).toEqual([{ a: 1 }])
    })

    it('with_entries', () => {
      // transform keys to uppercase
      expect(evalExpr('with_entries({key: ("KEY_" + .key), value: .value})', { a: 1 })).toEqual([
        { KEY_a: 1 },
      ])
      // transform values
      expect(evalExpr('with_entries({key: .key, value: (.value + 1)})', { a: 1 })).toEqual([
        { a: 2 },
      ])
    })
  })

  describe('string builtins', () => {
    it('split', () => {
      expect(evalExpr('split(",")', 'a,b,c')).toEqual([['a', 'b', 'c']])
    })

    it('join', () => {
      expect(evalExpr('join("-")', ['a', 'b'])).toEqual(['a-b'])
      expect(() => evalExpr('join("-")', [1, 2])).toThrow('join expects strings')
    })

    it('startswith/endswith', () => {
      expect(evalExpr('startswith("foo")', 'foobar')).toEqual([true])
      expect(evalExpr('startswith("bar")', 'foobar')).toEqual([false])
      expect(evalExpr('endswith("bar")', 'foobar')).toEqual([true])
    })

    it('contains', () => {
      expect(evalExpr('contains("bar")', 'foobar')).toEqual([true])
      expect(evalExpr('contains(["b"])', ['a', 'b', 'c'])).toEqual([true])
      expect(evalExpr('contains({a:1})', { a: 1, b: 2 })).toEqual([true])
      // Recursive
      expect(evalExpr('contains({a:[1]})', { a: [1, 2] })).toEqual([true])
      expect(evalExpr('contains({a:[3]})', { a: [1, 2] })).toEqual([false])
    })
  })
})
