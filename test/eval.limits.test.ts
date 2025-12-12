import { describe, expect, it } from 'vitest'
import { parse } from '../src/parser'
import { validate } from '../src/validate'
import { runAst, type EvalOptions } from '../src/eval'
import { RuntimeError } from '../src/errors'

const evalWithLimits = (expr: string, limits: NonNullable<EvalOptions['limits']>) => {
  const ast = parse(expr)
  validate(ast)
  return () => runAst(ast, null, { limits })
}

describe('eval limits', () => {
  it('enforces maxOutputs', () => {
    const run = evalWithLimits('(1,2,3)', { maxOutputs: 2 })
    expect(run).toThrow(RuntimeError)
  })

  it('enforces maxSteps', () => {
    const run = evalWithLimits('. + 1', { maxSteps: 1 })
    expect(run).toThrow(RuntimeError)
  })

  it('enforces maxDepth', () => {
    const run = evalWithLimits('. + 1', { maxDepth: 1 })
    expect(run).toThrow(RuntimeError)
  })
})
