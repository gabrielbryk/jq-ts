import { describe, expect, it } from 'vitest'
import { parse } from '../src/parser'
import { validate } from '../src/validate'

describe('validate', () => {
  it('accepts milestone 1 constructs', () => {
    const ast = parse('.foo | .bar // 1')
    expect(() => validate(ast)).not.toThrow()
  })

  it('accepts valid builtin calls', () => {
    const ast = parse('type')
    expect(() => validate(ast)).not.toThrow()
  })

  it('rejects unknown functions', () => {
    const ast = parse('unknown(.)')
    expect(() => validate(ast)).toThrow(/Unknown function/)
  })

  it('rejects arity mismatch', () => {
    const ast = parse('type(1)')
    expect(() => validate(ast)).toThrow(/expects 0 arguments/)
  })
})
