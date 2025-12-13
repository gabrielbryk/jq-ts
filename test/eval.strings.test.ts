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

describe('string utils', () => {
  it('index', () => {
    expect(evalExpr('"bar" | index("ba")')).toEqual([0])
    expect(evalExpr('"bar" | index("z")')).toEqual([null])
    expect(evalExpr('["a","b"] | index("b")')).toEqual([1])
  })
  it('rindex', () => {
    expect(evalExpr('"aba" | rindex("a")')).toEqual([2])
  })
  it('indices', () => {
    expect(evalExpr('"aba" | indices("a")')).toEqual([[0, 2]])
    expect(evalExpr('"aba" | indices("b")')).toEqual([[1]])
    expect(evalExpr('"aba" | indices("z")')).toEqual([[]])
  })
  it('explode', () => {
    expect(evalExpr('"foo" | explode')).toEqual([[102, 111, 111]])
    expect(evalExpr('"👍" | explode')).toEqual([[128077]])
  })
  it('implode', () => {
    expect(evalExpr('[102, 111, 111] | implode')).toEqual(['foo'])
    expect(evalExpr('[128077] | implode')).toEqual(['👍'])
  })
})
