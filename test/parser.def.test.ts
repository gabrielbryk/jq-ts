import { describe, expect, it } from 'vitest'
import { parse } from '../src/parser'
import type { DefNode, IdentityNode, LiteralNode } from '../src/ast'

describe('parser def', () => {
  it('parses simple def', () => {
    const ast = parse('def foo: 1; .') as DefNode
    expect(ast.kind).toBe('Def')
    expect(ast.name).toBe('foo')
    expect(ast.args).toEqual([])
    expect((ast.body as LiteralNode).kind).toBe('Literal')
    expect((ast.next as IdentityNode).kind).toBe('Identity')
  })

  it('parses def with args', () => {
    const ast = parse('def foo(x;y): x+y; .') as DefNode
    expect(ast.kind).toBe('Def')
    expect(ast.name).toBe('foo')
    expect(ast.args).toEqual(['x', 'y'])
  })

  it('parses nested defs', () => {
    const ast = parse('def foo: def bar: 1; bar; foo') as DefNode
    expect(ast.kind).toBe('Def')
    expect(ast.name).toBe('foo')
    expect((ast.body as DefNode).kind).toBe('Def')
    expect((ast.body as DefNode).name).toBe('bar')
  })
})
