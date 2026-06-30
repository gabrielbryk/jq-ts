import { describe, expect, it } from 'vitest'

import { run, type Value } from '../src'

const evalExpr = (expr: string, input: Value = null): Value[] => run(expr, input)
const one = (expr: string, input: Value = null): Value => {
  const out = evalExpr(expr, input)
  expect(out).toHaveLength(1)
  return out[0]!
}

describe('@-format filters', () => {
  describe('@text / @json', () => {
    it('@text coerces like tostring', () => {
      expect(one('@text', 5)).toBe('5')
      expect(one('@text', 'hi')).toBe('hi')
      expect(one('@text', null)).toBe('null')
      expect(one('@text', { a: 1 })).toBe('{"a":1}')
    })
    it('@json renders JSON (strings quoted)', () => {
      expect(one('@json', 'x')).toBe('"x"')
      expect(one('@json', [1, 'x', true, null])).toBe('[1,"x",true,null]')
      expect(one('@json', { a: 1 })).toBe('{"a":1}')
    })
  })

  describe('@base64 / @base64d', () => {
    it('encodes UTF-8 with padding', () => {
      expect(one('@base64', 'hello')).toBe('aGVsbG8=')
      expect(one('@base64', 'héllo→')).toBe('aMOpbGxv4oaS')
      expect(one('@base64', '')).toBe('')
      expect(one('@base64', 5)).toBe('NQ==')
    })
    it('decodes (padding optional) and round-trips', () => {
      expect(one('@base64d', 'aGVsbG8=')).toBe('hello')
      expect(one('@base64d', 'aGVsbG8')).toBe('hello')
      expect(one('@base64 | @base64d', 'héllo→')).toBe('héllo→')
    })
    it('rejects invalid base64', () => {
      expect(() => evalExpr('@base64d', '@@@@')).toThrow()
      expect(() => evalExpr('@base64d', 'a')).toThrow()
    })
  })

  describe('@base32 / @base32d (RFC 4648)', () => {
    it('encodes with padding', () => {
      expect(one('@base32', 'hello')).toBe('NBSWY3DP')
      expect(one('@base32', 'f')).toBe('MY======')
      expect(one('@base32', 'foobar')).toBe('MZXW6YTBOI======')
      expect(one('@base32', '')).toBe('')
    })
    it('decodes and round-trips', () => {
      expect(one('@base32d', 'NBSWY3DP')).toBe('hello')
      expect(one('@base32 | @base32d', 'héllo→')).toBe('héllo→')
    })
  })

  describe('@uri', () => {
    it('percent-encodes non-unreserved bytes (uppercase hex)', () => {
      expect(one('@uri', 'a b/c?d=e&f')).toBe('a%20b%2Fc%3Fd%3De%26f')
      expect(one('@uri', '-_.~abcXYZ09')).toBe('-_.~abcXYZ09')
      expect(one('@uri', "!*'()")).toBe('%21%2A%27%28%29')
      expect(one('@uri', 'héllo')).toBe('h%C3%A9llo')
    })
  })

  describe('@csv / @tsv', () => {
    it('@csv quotes strings and doubles quotes', () => {
      expect(one('@csv', [1, 'x,y', true, null, 3.5])).toBe('1,"x,y",true,,3.5')
      expect(one('@csv', ['a"b'])).toBe('"a""b"')
      expect(one('@csv', [])).toBe('')
    })
    it('@tsv escapes tab/newline/CR/backslash', () => {
      expect(one('@tsv', [1, 'x\ty', true, null])).toBe('1\tx\\ty\ttrue\t')
      expect(one('@tsv', ['a\nb\\c'])).toBe('a\\nb\\\\c')
    })
    it('rejects non-arrays and nested cells', () => {
      expect(() => evalExpr('@csv', 5)).toThrow()
      expect(() => evalExpr('@csv', [[1]])).toThrow()
      expect(() => evalExpr('@tsv', 5)).toThrow()
      expect(() => evalExpr('@tsv', [{}])).toThrow()
    })
  })

  describe('@sh', () => {
    it('shell-quotes strings and joins arrays', () => {
      expect(one('@sh', [1, "a'b", 'x y'])).toBe("1 'a'\\''b' 'x y'")
      expect(one('@sh', "don't")).toBe("'don'\\''t'")
      expect(one('@sh', null)).toBe('null')
      expect(one('@sh', [true, false])).toBe('true false')
    })
    it('rejects objects (and nested non-scalars)', () => {
      expect(() => evalExpr('@sh', {})).toThrow()
      expect(() => evalExpr('@sh', [[1]])).toThrow()
    })
  })

  describe('@html', () => {
    it('escapes & < > \' "', () => {
      expect(one('@html', '<a href=\'x\' title="y">&z</a>')).toBe(
        '&lt;a href=&apos;x&apos; title=&quot;y&quot;&gt;&amp;z&lt;/a&gt;'
      )
      expect(one('@html', 5)).toBe('5')
    })
  })

  describe('interpolation form', () => {
    it('applies the encoder to interpolated values, leaving literals raw', () => {
      expect(one('@base64 "x=\\(.x)"', { x: 'a b' })).toBe('x=YSBi')
      expect(one('@uri "p \\(.a)/\\(.b)"', { a: 'x y', b: 'p&q' })).toBe('p x%20y/p%26q')
      expect(one('@csv "row: \\([1,2])"', null)).toBe('row: 1,2')
    })
    it('a plain (non-interpolated) string is passed through unformatted', () => {
      expect(one('@base64 "x"', null)).toBe('x')
    })
    it('default string interpolation still uses @text', () => {
      expect(one('"v=\\(.x)"', { x: [1, 2] })).toBe('v=[1,2]')
    })
  })

  describe('validation', () => {
    it('rejects unknown @-format names', () => {
      expect(() => evalExpr('@foobar', 5)).toThrow(/not a valid format/)
    })
  })
})
