import { describe, expect, it } from 'vitest'

import { compileRegex, RegexError } from '../src/regex'

/** Compiles and runs a single leftmost search from `start`. */
const exec = (pattern: string, flags: string, input: string, start = 0) =>
  compileRegex(pattern, flags).exec(input, start)

describe('regex engine — literals and dot', () => {
  it('matches a literal substring with codepoint offsets', () => {
    expect(exec('abc', '', 'xxabcyy')).toEqual({ index: 2, length: 3, captures: [] })
  })

  it('returns null when there is no match', () => {
    expect(exec('abc', '', 'abx')).toBeNull()
  })

  it('. does not match a newline by default', () => {
    expect(exec('a.c', '', 'a\nc')).toBeNull()
    expect(exec('a.c', '', 'abc')).toEqual({ index: 0, length: 3, captures: [] })
  })

  it('. matches a newline under the s flag', () => {
    expect(exec('a.c', 's', 'a\nc')).toEqual({ index: 0, length: 3, captures: [] })
  })
})

describe('regex engine — character classes', () => {
  it('matches ranges greedily', () => {
    expect(exec('[a-c]+', '', 'zzabccd')).toEqual({ index: 2, length: 4, captures: [] })
  })

  it('matches negated classes', () => {
    expect(exec('[^0-9]+', '', '12ab34')).toEqual({ index: 2, length: 2, captures: [] })
  })

  it('supports shorthand classes \\d \\w \\s', () => {
    expect(exec('\\d+', '', 'ab123c')).toEqual({ index: 2, length: 3, captures: [] })
    expect(exec('\\w+', '', '  foo_1!')).toEqual({ index: 2, length: 5, captures: [] })
    expect(exec('a\\sb', '', 'a\tb')).toEqual({ index: 0, length: 3, captures: [] })
  })

  it('supports negated shorthand \\D and \\S', () => {
    expect(exec('\\D+', '', '42xy')).toEqual({ index: 2, length: 2, captures: [] })
    expect(exec('\\S+', '', '  hi ')).toEqual({ index: 2, length: 2, captures: [] })
  })
})

describe('regex engine — anchors and boundaries', () => {
  it('matches start and end anchors', () => {
    expect(exec('^abc$', '', 'abc')).toEqual({ index: 0, length: 3, captures: [] })
    expect(exec('^abc$', '', 'xabc')).toBeNull()
  })

  it('$ matches only end of string without the m flag', () => {
    expect(exec('a$', '', 'a\nb')).toBeNull()
    expect(exec('b$', '', 'a\nb')).toEqual({ index: 2, length: 1, captures: [] })
  })

  it('^ and $ match line boundaries under the m flag', () => {
    expect(exec('^b', 'm', 'a\nb')).toEqual({ index: 2, length: 1, captures: [] })
    expect(exec('a$', 'm', 'a\nb')).toEqual({ index: 0, length: 1, captures: [] })
  })

  it('honors word boundaries \\b and \\B', () => {
    expect(exec('\\bcat\\b', '', 'a cat!')).toEqual({ index: 2, length: 3, captures: [] })
    expect(exec('\\bcat\\b', '', 'category')).toBeNull()
    expect(exec('\\Bcat', '', 'category')).toBeNull()
    expect(exec('\\Bid', '', 'rapid')).toEqual({ index: 3, length: 2, captures: [] })
  })
})

describe('regex engine — quantifiers', () => {
  it('greedy vs lazy *', () => {
    expect(exec('a.*b', '', 'a1b2b')).toEqual({ index: 0, length: 5, captures: [] })
    expect(exec('a.*?b', '', 'a1b2b')).toEqual({ index: 0, length: 3, captures: [] })
  })

  it('greedy vs lazy + and ?', () => {
    expect(exec('a+', '', 'baaa')).toEqual({ index: 1, length: 3, captures: [] })
    expect(exec('a+?', '', 'baaa')).toEqual({ index: 1, length: 1, captures: [] })
    expect(exec('ab?', '', 'ab')).toEqual({ index: 0, length: 2, captures: [] })
    expect(exec('ab??', '', 'ab')).toEqual({ index: 0, length: 1, captures: [] })
  })

  it('counted repetition {n}, {n,}, {n,m}', () => {
    expect(exec('a{2}', '', 'aaaa')).toEqual({ index: 0, length: 2, captures: [] })
    expect(exec('a{2,}', '', 'aaaa')).toEqual({ index: 0, length: 4, captures: [] })
    expect(exec('a{2,3}', '', 'aaaaa')).toEqual({ index: 0, length: 3, captures: [] })
    expect(exec('a{2,3}?', '', 'aaaaa')).toEqual({ index: 0, length: 2, captures: [] })
  })
})

describe('regex engine — alternation and groups', () => {
  it('matches ordered alternation (first branch wins)', () => {
    expect(exec('cat|dog', '', 'a dog')).toEqual({ index: 2, length: 3, captures: [] })
    expect(exec('a|ab', '', 'ab')).toEqual({ index: 0, length: 1, captures: [] })
  })

  it('captures numbered groups', () => {
    expect(exec('(\\d+)-(\\d+)', '', '12-345')).toEqual({
      index: 0,
      length: 6,
      captures: [
        { index: 0, length: 2, name: null },
        { index: 3, length: 3, name: null },
      ],
    })
  })

  it('captures named groups', () => {
    expect(exec('(?<year>\\d{4})-(?<mon>\\d{2})', '', '2024-06')).toEqual({
      index: 0,
      length: 7,
      captures: [
        { index: 0, length: 4, name: 'year' },
        { index: 5, length: 2, name: 'mon' },
      ],
    })
  })

  it('non-capturing groups do not produce captures', () => {
    expect(exec('(?:ab)+', '', 'ababab')).toEqual({ index: 0, length: 6, captures: [] })
  })

  it('reports null for groups that did not participate', () => {
    expect(exec('(a)|(b)', '', 'b')).toEqual({
      index: 0,
      length: 1,
      captures: [null, { index: 0, length: 1, name: null }],
    })
  })
})

describe('regex engine — flags', () => {
  it('matches case-insensitively under the i flag', () => {
    expect(exec('abc', 'i', 'XABCY')).toEqual({ index: 1, length: 3, captures: [] })
    expect(exec('[a-c]+', 'i', 'ZAbC')).toEqual({ index: 1, length: 3, captures: [] })
  })

  it('ignores whitespace and comments under the x flag', () => {
    expect(exec('a b c   # the abc', 'x', 'xabc')).toEqual({ index: 1, length: 3, captures: [] })
    expect(exec('[a b]+', 'x', 'za b!')).toEqual({ index: 1, length: 3, captures: [] })
  })

  it('rejects unknown flags', () => {
    expect(() => compileRegex('abc', 'z')).toThrow(/unknown regex flag/)
  })
})

describe('regex engine — unicode codepoints', () => {
  it('reports offsets in codepoints, not UTF-16 units', () => {
    expect(exec('abc', '', '😀abc')).toEqual({ index: 1, length: 3, captures: [] })
  })

  it('captures offsets after an emoji in codepoints', () => {
    expect(exec('(b)', '', '😀ab')).toEqual({
      index: 2,
      length: 1,
      captures: [{ index: 2, length: 1, name: null }],
    })
  })

  it('matches non-ASCII literals', () => {
    expect(exec('café', '', 'a café here')).toEqual({ index: 2, length: 4, captures: [] })
  })
})

describe('regex engine — global iteration and empty matches', () => {
  it('iterates non-overlapping matches', () => {
    const matches = compileRegex('a').matchAll('banana')
    expect(matches.map((m) => m.index)).toEqual([1, 3, 5])
  })

  it('advances past empty matches by one codepoint', () => {
    const matches = compileRegex('').matchAll('ab')
    expect(matches.map((m) => ({ i: m.index, l: m.length }))).toEqual([
      { i: 0, l: 0 },
      { i: 1, l: 0 },
      { i: 2, l: 0 },
    ])
  })

  it('handles a quantifier that can match empty', () => {
    expect(exec('a*', '', 'baa')).toEqual({ index: 0, length: 0, captures: [] })
    expect(exec('a*', '', 'baa', 1)).toEqual({ index: 1, length: 2, captures: [] })
  })
})

describe('regex engine — rejected features', () => {
  it('rejects numeric backreferences', () => {
    expect(() => compileRegex('(\\w)\\1')).toThrow(RegexError)
    expect(() => compileRegex('(\\w)\\1')).toThrow(/backreference/)
  })

  it('rejects named backreferences', () => {
    expect(() => compileRegex('(?<a>x)\\k<a>')).toThrow(/backreference/)
  })

  it('rejects lookahead', () => {
    expect(() => compileRegex('a(?=b)')).toThrow(/lookahead/)
    expect(() => compileRegex('a(?!b)')).toThrow(/lookahead/)
  })

  it('rejects lookbehind', () => {
    expect(() => compileRegex('(?<=a)b')).toThrow(/lookbehind/)
    expect(() => compileRegex('(?<!a)b')).toThrow(/lookbehind/)
  })

  it('rejects atomic groups', () => {
    expect(() => compileRegex('(?>ab)')).toThrow(/atomic group/)
  })

  it('rejects possessive quantifiers', () => {
    expect(() => compileRegex('a++')).toThrow(/possessive/)
    expect(() => compileRegex('a*+')).toThrow(/possessive/)
    expect(() => compileRegex('a{1,2}+')).toThrow(/possessive/)
  })
})
