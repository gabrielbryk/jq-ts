import { describe, expect, it } from 'vitest'
import { analyzeCompatibility, checkCompatibility, compareWithJq, type JqRunner } from '../src'

describe('compatibility helpers', () => {
  it('accepts expressions that parse and validate', () => {
    expect(checkCompatibility('.foo // "fallback"')).toEqual({
      compatible: true,
      findings: [],
    })
  })

  it('reports unsupported builtins', () => {
    const result = checkCompatibility('test("a+")')

    expect(result.compatible).toBe(false)
    expect(result.findings[0]).toMatchObject({
      severity: 'error',
      stage: 'validate',
      category: 'unsupported-builtin',
      message: 'Unknown function: test',
    })
  })

  it('reports parse errors as unsupported syntax', () => {
    const result = checkCompatibility('@json')

    expect(result.compatible).toBe(false)
    expect(result.findings[0]).toMatchObject({
      severity: 'error',
      stage: 'lex',
      category: 'unsupported-syntax',
    })
  })

  it('adds known semantic warnings for accepted expressions', () => {
    const result = analyzeCompatibility('unique | tostring')

    expect(result.compatible).toBe(true)
    expect(result.warnings.map((warning) => warning.category)).toEqual([
      'semantic-deviation',
      'semantic-deviation',
    ])
    expect(result.warnings.map((warning) => warning.message).join('\n')).toContain(
      'jq sorts unique results'
    )
    expect(result.warnings.map((warning) => warning.message).join('\n')).toContain(
      'stable sorted-key stringification'
    )
  })

  it('warns for jq special variables that jq-ts does not populate', () => {
    const result = analyzeCompatibility('$ENV')

    expect(result.compatible).toBe(true)
    expect(result.warnings[0]).toMatchObject({
      category: 'intentional-exclusion',
    })
    expect(result.warnings[0]?.message).toContain('$ENV')
  })

  it('compares jq-ts output with a caller-provided jq runner', () => {
    const jq: JqRunner = () => [{ a: 1 }]
    const result = compareWithJq('.', { a: 1 }, jq)

    expect(result.compatible).toBe(true)
    expect(result.equivalent).toBe(true)
    expect(result.findings).toEqual([])
  })

  it('reports output mismatches from the comparison runner', () => {
    const jq: JqRunner = () => [[1, 2, 3]]
    const result = compareWithJq('unique', [3, 1, 2, 1], jq)

    expect(result.compatible).toBe(true)
    expect(result.equivalent).toBe(false)
    expect(result.findings.some((finding) => finding.category === 'output-mismatch')).toBe(true)
    expect(result.findings.some((finding) => finding.category === 'semantic-deviation')).toBe(true)
  })
})
