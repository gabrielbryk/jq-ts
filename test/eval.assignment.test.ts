import { describe, expect, it } from 'vitest'
import { runAst } from '../src/eval'
import { parse } from '../src/parser'

import type { Value } from '../src/value'

const evalExpr = (expr: string, input: Value = null) => {
  const ast = parse(expr)
  return runAst(ast, input)
}

describe('eval assignment', () => {
  describe('simple assignment =', () => {
    it('assigns to field', () => {
      expect(evalExpr('.a = 1', {})).toEqual([{ a: 1 }])
      expect(evalExpr('.a = 1', { b: 2 })).toEqual([{ a: 1, b: 2 }])
    })
    it('assigns to array index', () => {
      expect(evalExpr('.[0] = 1', [])).toEqual([[1]])
      expect(evalExpr('.[1] = 2', [1])).toEqual([[1, 2]])
    })
    it('assigns to multiple paths', () => {
      // (.a, .b) = 1
      expect(evalExpr('(.a, .b) = 1', {})).toEqual([{ a: 1, b: 1 }])
    })
    it('assigns multiple values from RHS', () => {
      // .a = (1, 2) -> {a:1}, {a:2}
      expect(evalExpr('.a = (1, 2)', {})).toEqual([{ a: 1 }, { a: 2 }])
    })
    it('assigns deep path', () => {
      expect(evalExpr('.a.b = 1', {})).toEqual([{ a: { b: 1 } }])
    })
  })

  describe('update assignment |=', () => {
    it('updates value at path', () => {
      expect(evalExpr('.a |= . + 1', { a: 1 })).toEqual([{ a: 2 }])
    })
    it('updates with empty (delete)', () => {
      // .a |= empty usually suppresses output in pipe, but for assignment?
      // "If the RHS outputs no values, then no path update is done"?
      // jq: `{"a":1} | .a |= empty` -> `{"a":1}`? NO.
      // jq: `{"a":1} | .a |= empty` -> (no output).
      // Wait, implies the object is dropped?
      // My implementation drops if `newValues` is empty.
      expect(evalExpr('.a |= empty', { a: 1 })).toEqual([])
    })
    it('updates deep path', () => {
      expect(evalExpr('.a.b |= . * 2', { a: { b: 2 } })).toEqual([{ a: { b: 4 } }])
    })
  })

  describe('operator assignment +=, -=, etc', () => {
    it('+= increments', () => {
      expect(evalExpr('.a += 1', { a: 1 })).toEqual([{ a: 2 }])
    })
    it('+= works with arrays', () => {
      expect(evalExpr('.a += [2]', { a: [1] })).toEqual([{ a: [1, 2] }])
    })
    it('-= decrements', () => {
      expect(evalExpr('.a -= 1', { a: 2 })).toEqual([{ a: 1 }])
    })
    it('+= with RHS referencing input', () => {
      // .a += .b
      expect(evalExpr('.a += .b', { a: 1, b: 2 })).toEqual([{ a: 3, b: 2 }])
    })
    it('//= defaults', () => {
      expect(evalExpr('.a //= 2', { a: null })).toEqual([{ a: 2 }])
      expect(evalExpr('.a //= 2', { a: false })).toEqual([{ a: 2 }])
      expect(evalExpr('.a //= 2', { a: 0 })).toEqual([{ a: 0 }])
    })
  })

  describe('path expressions', () => {
    it('supports pipe in path', () => {
      // .a | .b = 1  -> (.a | .b) = 1 -> sets .a.b = 1
      expect(evalExpr('(.a | .b) = 1', {})).toEqual([{ a: { b: 1 } }])
    })
    it('supports array index in path', () => {
      expect(evalExpr('.a[0] = 1', { a: [] })).toEqual([{ a: [1] }])
    })
  })
})
