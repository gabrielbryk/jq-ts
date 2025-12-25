import { describe, expect, it } from 'vitest'
import { parse } from '../src/parser'

describe('parser', () => {
  it('respects boolean precedence', () => {
    const ast = parse('true or false and false')
    expect(ast).toMatchObject({
      kind: 'Bool',
      op: 'Or',
      left: { kind: 'Literal', value: true },
      right: {
        kind: 'Bool',
        op: 'And',
        left: { kind: 'Literal', value: false },
        right: { kind: 'Literal', value: false },
      },
    })
  })

  it('parses comma and alt precedence', () => {
    const ast = parse('null, 1 // 2')
    expect(ast).toMatchObject({
      kind: 'Comma',
      left: { kind: 'Literal', value: null },
      right: {
        kind: 'Alt',
        left: { kind: 'Literal', value: 1 },
        right: { kind: 'Literal', value: 2 },
      },
    })
  })

  it('parses pipes after alt', () => {
    const ast = parse('1 // 2 | 3')
    expect(ast).toMatchObject({
      kind: 'Pipe',
      left: { kind: 'Alt' },
      right: { kind: 'Literal', value: 3 },
    })
  })

  it('parses field/index chains', () => {
    const ast = parse('.foo[0].bar')
    expect(ast).toMatchObject({
      kind: 'FieldAccess',
      field: 'bar',
      target: {
        kind: 'IndexAccess',
        target: {
          kind: 'FieldAccess',
          field: 'foo',
          target: { kind: 'Identity' },
        },
      },
    })
  })

  it('parses as bindings', () => {
    const ast = parse('(1,2) as $x | $x')
    expect(ast).toMatchObject({
      kind: 'As',
      name: 'x',
      bind: { kind: 'Comma' },
      body: { kind: 'Var', name: 'x' },
    })
  })

  it('parses if expressions with elif', () => {
    const ast = parse('if . then 1 elif . == 2 then 3 else 4 end')
    expect(ast).toMatchObject({
      kind: 'If',
      branches: [
        { cond: { kind: 'Identity' }, then: { kind: 'Literal', value: 1 } },
        {
          cond: { kind: 'Binary', op: 'Eq' },
          then: { kind: 'Literal', value: 3 },
        },
      ],
      else: { kind: 'Literal', value: 4 },
    })
  })

  it('parses not as a call after pipe', () => {
    const ast = parse('. | not')
    expect(ast).toMatchObject({
      kind: 'Pipe',
      left: { kind: 'Identity' },
      right: { kind: 'Call', name: 'not', args: [] },
    })
  })
})
