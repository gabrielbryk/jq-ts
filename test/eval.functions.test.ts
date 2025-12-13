import { describe, expect, it } from 'vitest'
import { runAst } from '../src/eval'
import { parse } from '../src/parser'

import type { Value } from '../src/value'

const evalExpr = (expr: string, input: Value = null) => {
  const ast = parse(expr)
  return runAst(ast, input)
}

describe('eval functions', () => {
  it('defines and calls simple function', () => {
    expect(evalExpr('def foo: 42; foo')).toEqual([42])
  })

  it('passes arguments', () => {
    expect(evalExpr('def inc(x): x + 1; inc(10)')).toEqual([11])
  })

  it('arguments are filters applied to logic', () => {
    // inc(.+1) -> (.+1) + 1. input is 10. (10+1)+1 = 12
    expect(evalExpr('def inc(f): f + 1; inc(.+1)', 10)).toEqual([12])
  })

  it('supports recursion', () => {
    // fact
    const expr = `
          def fact: if . == 0 then 1 else . * (. - 1 | fact) end;
          5 | fact
        `
    expect(evalExpr(expr)).toEqual([120])
  })

  it('supports lexical scoping (closures)', () => {
    // x captured from outer scope
    // Note: jq syntax requires (def...) if in pipeline, or just nested defs.
    // `10 as $x | def ...` is invalid because PIPE has lower precedence than DEF in our parser/jq?
    // Actually jq requires parens for def in pipe.
    const expr = `
          10 as $x |
          (def addX(y): y + $x; addX(5))
        `
    expect(evalExpr(expr)).toEqual([15])
  })

  it('shadows builtins', () => {
    expect(evalExpr('def type: "custom"; type', 'hello')).toEqual(['custom'])
  })

  it('supports function overloading by arity', () => {
    const expr = `
          def foo: 0;
          def foo(x): x;
          foo, foo(1)
        `
    expect(evalExpr(expr)).toEqual([0, 1])
  })
})
