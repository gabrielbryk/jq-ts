import { describe, expect, it } from 'vitest'

import { run } from '../src/index'
import type { Value } from '../src/value'

/** Runs a jq expression and returns the full output stream. */
const out = (expr: string, input: Value): Value[] => run(expr, input)
/** Runs a jq expression expected to yield exactly one value. */
const one = (expr: string, input: Value): Value => {
  const r = run(expr, input)
  expect(r).toHaveLength(1)
  return r[0]!
}

describe('regex builtins — test', () => {
  it('returns booleans (with and without flags)', () => {
    expect(one('test("b")', 'abc')).toBe(true)
    expect(one('test("z")', 'abc')).toBe(false)
    expect(one('test("B"; "i")', 'abc')).toBe(true)
  })

  it('accepts the [re, flags] array form', () => {
    expect(one('test(["B","i"])', 'abc')).toBe(true)
  })

  it('errors on a non-string subject', () => {
    expect(() => run('test("1")', 123)).toThrow(/not a string/)
  })
})

describe('regex builtins — match', () => {
  it('returns the jq match shape for the first match', () => {
    expect(one('match("b")', 'abc')).toEqual({
      offset: 1,
      length: 1,
      string: 'b',
      captures: [],
    })
  })

  it('reports named captures with offsets/lengths', () => {
    expect(one('match("(?<y>[0-9]+)-(?<m>[0-9]+)-(?<d>[0-9]+)")', '2024-01-02')).toEqual({
      offset: 0,
      length: 10,
      string: '2024-01-02',
      captures: [
        { offset: 0, length: 4, string: '2024', name: 'y' },
        { offset: 5, length: 2, string: '01', name: 'm' },
        { offset: 8, length: 2, string: '02', name: 'd' },
      ],
    })
  })

  it('marks non-participating groups with offset -1 and null string', () => {
    expect(one('match("(a)(b)?")', 'a')).toEqual({
      offset: 0,
      length: 1,
      string: 'a',
      captures: [
        { offset: 0, length: 1, string: 'a', name: null },
        { offset: -1, length: 0, string: null, name: null },
      ],
    })
  })

  it('streams all matches with the g flag', () => {
    expect(out('match("b"; "g")', 'abcabc')).toEqual([
      { offset: 1, length: 1, string: 'b', captures: [] },
      { offset: 4, length: 1, string: 'b', captures: [] },
    ])
  })

  it('emits empty matches per codepoint with g', () => {
    expect(out('match(""; "g")', 'abc')).toEqual([
      { offset: 0, length: 0, string: '', captures: [] },
      { offset: 1, length: 0, string: '', captures: [] },
      { offset: 2, length: 0, string: '', captures: [] },
      { offset: 3, length: 0, string: '', captures: [] },
    ])
  })

  it('returns nothing when there is no match', () => {
    expect(out('match("z")', 'abc')).toEqual([])
  })

  it('counts offsets in codepoints across astral characters', () => {
    expect(out('match("x"; "g")', '😀x😀')).toEqual([
      { offset: 1, length: 1, string: 'x', captures: [] },
    ])
  })
})

describe('regex builtins — capture', () => {
  it('maps named groups to their captured strings', () => {
    expect(one('capture("(?<y>[0-9]+)-(?<m>[0-9]+)")', '2024-01')).toEqual({ y: '2024', m: '01' })
  })

  it('uses null for a non-participating named group', () => {
    expect(one('capture("(?<x>a)(?<y>b)?")', 'a')).toEqual({ x: 'a', y: null })
  })

  it('returns an empty object when there are no named groups', () => {
    expect(one('capture("b")', 'abc')).toEqual({})
  })

  it('streams one object per match with g', () => {
    expect(out('capture("(?<L>[a-z])(?<D>[0-9])"; "g")', 'a1b2')).toEqual([
      { L: 'a', D: '1' },
      { L: 'b', D: '2' },
    ])
  })
})

describe('regex builtins — scan', () => {
  it('emits matched substrings when there are no groups', () => {
    expect(out('scan("b")', 'abcabc')).toEqual(['b', 'b'])
  })

  it('emits the array of captures when the regex has groups', () => {
    expect(out('scan("([a-z])([0-9])")', 'a1b2')).toEqual([
      ['a', '1'],
      ['b', '2'],
    ])
  })

  it('honors flags', () => {
    expect(out('scan("x"; "i")', 'aXbXc')).toEqual(['X', 'X'])
  })
})

describe('regex builtins — splits / split(re; flags)', () => {
  it('splits on a regex into a stream', () => {
    expect(out('splits("[0-9]")', 'a1b2c')).toEqual(['a', 'b', 'c'])
  })

  it('returns the pieces as an array for split/2', () => {
    expect(one('split("[0-9]"; null)', 'a1b2c')).toEqual(['a', 'b', 'c'])
  })

  it('does not break the 1-arg literal split', () => {
    expect(one('split(".")', 'a.b.c')).toEqual(['a', 'b', 'c'])
  })

  it('honors flags', () => {
    expect(out('splits("x"; "i")', 'aXbxc')).toEqual(['a', 'b', 'c'])
  })
})

describe('regex builtins — sub', () => {
  it('replaces only the first match', () => {
    expect(one('sub("b"; "X")', 'abcabc')).toBe('aXcabc')
  })

  it('passes the capture object as input to the replacement filter', () => {
    expect(one('sub("(?<x>a)(?<y>b)?"; "[\\(.x)][\\(.y)]")', 'a')).toBe('[a][null]')
  })

  it('honors flags', () => {
    expect(one('sub("b"; "X"; "i")', 'aBc')).toBe('aXc')
  })

  it('yields the input unchanged when there is no match', () => {
    expect(one('sub("z"; "X")', 'abc')).toBe('abc')
  })

  it('yields the input when the replacement produces nothing', () => {
    expect(one('sub("b"; empty)', 'abc')).toBe('abc')
  })

  it('streams one output per replacement value', () => {
    expect(out('sub("b"; "X","Y")', 'abc')).toEqual(['aXc', 'aYc'])
  })
})

describe('regex builtins — gsub', () => {
  it('replaces every match', () => {
    expect(one('gsub("b"; "X")', 'abcabc')).toBe('aXcaXc')
  })

  it('evaluates the replacement filter per match', () => {
    expect(one('gsub("(?<x>.)"; "\\(.x)\\(.x)")', 'abc')).toBe('aabbcc')
  })

  it('replaces empty matches around each codepoint', () => {
    expect(one('gsub(""; "-")', 'abc')).toBe('-a-b-c-')
  })

  it('zips multi-output replacement filters across matches', () => {
    expect(out('[gsub("(?<x>.)"; .x, "Z")]', 'abc')).toEqual([['abc', 'ZZZ']])
  })

  it('zips asymmetric replacement-output counts', () => {
    expect(out('[gsub("(?<x>.)"; .x, "1", "2")]', 'ab')).toEqual([['ab', '11', '22']])
  })
})
