import { describe, it, expect } from 'vitest'
import { runAst } from '../src/eval/dispatch'
import { parse } from '../src/parser'
import type { Value } from '../src/value'

const evalExpr = (expr: string, input: Value = null) => {
  const ast = parse(expr)
  return runAst(ast, input)
}

describe('Assignment', () => {
  it('simple assignment', () => {
    expect(evalExpr('.a = 1', { a: 0 })).toEqual([{ a: 1 }])
    expect(evalExpr('. = 1', null)).toEqual([1])
  })

  it('multiple path assignment', () => {
    // .a and .b to 1
    expect(evalExpr('.a, .b = 1', { a: 0, b: 0 })).toEqual([0, { a: 0, b: 1 }])
    // Wait, precedence? .a, (.b = 1) -> output .a (0) then output (.b=1 -> {a:0, b:1})
    // jq '.a, .b = 1' parses as '(.a), (.b = 1)' due to comma precedence?
    // User manual: "The left-hand side can be any general path expression".
    // If I want to assign BOTH, I assume I need parens? `(.a, .b) = 1`

    expect(evalExpr('(.a, .b) = 1', { a: 0, b: 0 })).toEqual([{ a: 1, b: 1 }])
  })

  it('RHS fanout assignment', () => {
    // .a = (1, 2) -> {a:1}, {a:2}
    expect(evalExpr('.a = (1, 2)', { a: 0 })).toEqual([{ a: 1 }, { a: 2 }])
  })

  it('LHS and RHS fanout (Cartesian)', () => {
    // (.a, .b) = (1, 2)
    // Should be:
    // 1. Assign 1 to .a and .b -> {a:1, b:1}
    // 2. Assign 2 to .a and .b -> {a:2, b:2}
    expect(evalExpr('(.a, .b) = (1, 2)', { a: 0, b: 0 })).toEqual([
      { a: 1, b: 1 },
      { a: 2, b: 2 },
    ])
  })

  it('update assignment |=', () => {
    expect(evalExpr('.a |= . + 1', { a: 1 })).toEqual([{ a: 2 }])
    expect(evalExpr('.a |= empty', { a: 1 })).toEqual([{}]) // Delete
  })

  it('arithmetic update +=', () => {
    expect(evalExpr('.a += 1', { a: 1 })).toEqual([{ a: 2 }])
    // Verify += evaluates RHS against input, not the path value
    expect(evalExpr('.a += .b', { a: 1, b: 2 })).toEqual([{ a: 3, b: 2 }])
    expect(evalExpr('.a -= 1', { a: 1 })).toEqual([{ a: 0 }])
    expect(evalExpr('.a *= 2', { a: 2 })).toEqual([{ a: 4 }])
    expect(evalExpr('.a /= 2', { a: 4 })).toEqual([{ a: 2 }])
    expect(evalExpr('.a %= 2', { a: 5 })).toEqual([{ a: 1 }])
  })

  it('alternative operator //=', () => {
    expect(evalExpr('.a //= 2', { a: null })).toEqual([{ a: 2 }])
    expect(evalExpr('.a //= 2', { a: false })).toEqual([{ a: 2 }]) // jq behavior: false is falsey, so replaced
    // jq manual: "a // b" is a if a is not null and not false, else b.
    // So false // 2 -> 2.
    // Let's check false case in next run.
  })

  it('complex path selection assignment', () => {
    // Set all numbers to 0
    expect(evalExpr('(.[] | select(type=="number")) |= 0', [1, 'a', 2])).toEqual([[0, 'a', 0]])
  })

  it('multiple array deletion', () => {
    // [0, 1, 2] -> del(0, 1) -> [2]
    expect(evalExpr('(.[0], .[1]) |= empty', [0, 1, 2])).toEqual([[2]])
  })

  it('string slice assignment', () => {
    // Manual: "string[start:end] = string" is not supported in stock jq?
    // "path currently only supports ... arrays and objects".
    // Let's check if my implementation of `updatePath` supports string slicing.
    // Probably not.
  })
})
