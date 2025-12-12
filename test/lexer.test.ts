import { describe, expect, it } from 'vitest'
import { lex } from '../src/lexer'

const kinds = (code: string) => lex(code).map((t) => t.kind)

describe('lexer', () => {
  it('lexes identifiers, pipes, and alt', () => {
    expect(kinds('.foo // "bar" | $baz')).toEqual([
      'Dot',
      'Identifier',
      'Alt',
      'String',
      'Pipe',
      'Variable',
      'EOF',
    ])
  })

  it('parses strings with escapes', () => {
    const tokens = lex('"a\\n\\u0041"')
    expect(tokens[0]).toMatchObject({
      kind: 'String',
      value: 'a\nA',
    })
  })

  it('lexes keywords', () => {
    expect(kinds('null')).toEqual(['Null', 'EOF'])
    expect(kinds('true')).toEqual(['True', 'EOF'])
    expect(kinds('false')).toEqual(['False', 'EOF'])
    expect(kinds('reduce')).toEqual(['Reduce', 'EOF'])
    expect(kinds('foreach')).toEqual(['Foreach', 'EOF'])
    expect(kinds('try')).toEqual(['Try', 'EOF'])
    expect(kinds('catch')).toEqual(['Catch', 'EOF'])
    expect(kinds('.[]')).toEqual(['Dot', 'LBracket', 'RBracket', 'EOF'])
  })

  it('tracks spans across newlines', () => {
    const tokens = lex('foo\nbar')
    expect(tokens[0]?.span).toEqual({ start: 0, end: 3 })
    expect(tokens[1]?.span).toEqual({ start: 4, end: 7 })
  })
})
