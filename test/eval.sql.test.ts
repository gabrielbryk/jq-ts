import { describe, expect, it } from 'vitest'

import { type EvalOptions, runAst } from '../src/eval'
import { parse } from '../src/parser'
import { validate } from '../src/validate'
import type { Value } from '../src/value'

const evalExpr = (expr: string, input: Value = null, options?: EvalOptions) => {
  const ast = parse(expr)
  validate(ast)
  return runAst(ast, input, options)
}

describe('SQL-style builtins', () => {
  describe('INDEX', () => {
    it('INDEX(idx_expr) keys the input array by the index expression', () => {
      expect(
        evalExpr('INDEX(.id)', [
          { id: 'a', v: 1 },
          { id: 'b', v: 2 },
        ])
      ).toEqual([{ a: { id: 'a', v: 1 }, b: { id: 'b', v: 2 } }])
    })

    it('INDEX(stream; idx_expr) keys a stream by the index expression', () => {
      expect(evalExpr('INDEX({id:"x",n:1},{id:"y",n:2}; .id)', null)).toEqual([
        { x: { id: 'x', n: 1 }, y: { id: 'y', n: 2 } },
      ])
    })

    it('later entries with the same key win', () => {
      expect(
        evalExpr('INDEX(.k)', [
          { k: 'a', n: 1 },
          { k: 'a', n: 2 },
        ])
      ).toEqual([{ a: { k: 'a', n: 2 } }])
    })
  })

  describe('IN', () => {
    it('IN(s) is true when the input equals some output of s', () => {
      expect(evalExpr('IN(1,2,3)', 2)).toEqual([true])
      expect(evalExpr('IN(1,2,3)', 9)).toEqual([false])
    })

    it('IN(source; s) is true when some output of source is in s', () => {
      expect(evalExpr('IN(1,2,3; 2,5)', null)).toEqual([true])
      expect(evalExpr('IN(7,8; 2,5)', null)).toEqual([false])
    })
  })
})
