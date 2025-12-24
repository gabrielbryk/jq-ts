import { describe, expect, it } from 'vitest'
import { parse } from '../src/parser'
import type { AssignmentNode, CommaNode } from '../src/ast'

describe('parser assignments', () => {
  it('parses basic assignment', () => {
    const ast = parse('.a = 1') as AssignmentNode
    expect(ast.kind).toBe('Assignment')
    expect(ast.op).toBe('=')
    expect(ast.left.kind).toBe('FieldAccess')
    expect(ast.right.kind).toBe('Literal')
  })

  it('parses update assignment', () => {
    const ast = parse('.a |= .+1') as AssignmentNode
    expect(ast.kind).toBe('Assignment')
    expect(ast.op).toBe('|=')
  })

  it('handles precedence correctly (lower than pipe)', () => {
    // .a | .b = 1  -> .a | (.b = 1)
    const ast = parse('.a | .b = 1')
    expect(ast.kind).toBe('Pipe')
  })

  it('handles precedence correctly (higher than comma)', () => {
    // .a = 1, .b = 2 -> (.a = 1), (.b = 2)
    const ast = parse('.a = 1, .b = 2') as CommaNode
    expect(ast.kind).toBe('Comma')
    expect(ast.left.kind).toBe('Assignment')
    expect(ast.right.kind).toBe('Assignment')
  })
})
