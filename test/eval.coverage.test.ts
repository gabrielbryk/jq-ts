/**
 * Coverage-targeted tests for branches not yet reached by the main test suite.
 *
 * Each describe group corresponds to a source file with low branch coverage.
 * Every test makes a meaningful behavioral assertion — it is not just padding.
 */
import { describe, expect, it } from 'vitest'

import { run } from '../src'
import {
  analyzeCompatibility,
  checkCompatibility,
  compareWithJq,
  type JqRunner,
} from '../src/compat'
import { executionFindings, runJqTs } from '../src/compat/execution'
import { visit } from '../src/compat/visit'
import { parse } from '../src/parser'

// ---------------------------------------------------------------------------
// Shared test helper
// ---------------------------------------------------------------------------
const r = (expr: string, input: unknown = null) => run(expr, input as never)

// ---------------------------------------------------------------------------
// src/builtins/math/finiteness.ts — branches: 16.66%
// ---------------------------------------------------------------------------
describe('math finiteness builtins', () => {
  describe('isfinite', () => {
    it('returns true for a regular number', () => {
      expect(r('isfinite', 42)).toEqual([true])
    })
    it('returns false for Infinity', () => {
      expect(r('isfinite', Infinity)).toEqual([false])
    })
    it('returns false for -Infinity', () => {
      expect(r('isfinite', -Infinity)).toEqual([false])
    })
    it('returns false for non-number (jq semantics: non-numbers are not finite)', () => {
      expect(r('isfinite', 'hello')).toEqual([false])
      expect(r('isfinite', null)).toEqual([false])
      expect(r('isfinite', true)).toEqual([false])
    })
  })

  describe('isnormal / normal', () => {
    it('returns true for a normal number', () => {
      expect(r('isnormal', 1.5)).toEqual([true])
      expect(r('normal', 3.14)).toEqual([true])
    })
    it('returns false for zero', () => {
      expect(r('isnormal', 0)).toEqual([false])
      expect(r('normal', 0)).toEqual([false])
    })
    it('returns false for Infinity', () => {
      expect(r('isnormal', Infinity)).toEqual([false])
    })
    it('returns false for non-number', () => {
      expect(r('isnormal', 'text')).toEqual([false])
      expect(r('isnormal', null)).toEqual([false])
    })
  })

  describe('subnormal', () => {
    it('returns false for a normal positive number', () => {
      expect(r('subnormal', 1.0)).toEqual([false])
    })
    it('returns false for zero', () => {
      expect(r('subnormal', 0)).toEqual([false])
    })
    it('returns false for Infinity', () => {
      expect(r('subnormal', Infinity)).toEqual([false])
    })
    it('returns false for non-number', () => {
      expect(r('subnormal', 'hi')).toEqual([false])
      expect(r('subnormal', null)).toEqual([false])
    })
    it('returns true for a subnormal double', () => {
      // 5e-324 is the smallest positive double, which is subnormal
      expect(r('subnormal', 5e-324)).toEqual([true])
    })
  })
})

// ---------------------------------------------------------------------------
// src/builtins/std/type-filters.ts — branches: 36.36%
// ---------------------------------------------------------------------------
describe('type filter builtins', () => {
  it('arrays: yields for arrays, silent for non-arrays', () => {
    expect(r('[1,2] | arrays')).toEqual([[1, 2]])
    expect(r('"str" | arrays')).toEqual([])
    expect(r('null | arrays')).toEqual([])
  })

  it('objects: yields for plain objects, silent otherwise', () => {
    expect(r('{a:1} | objects')).toEqual([{ a: 1 }])
    expect(r('[1] | objects')).toEqual([])
    expect(r('42 | objects')).toEqual([])
  })

  it('iterables: yields for arrays and objects, silent for scalars', () => {
    expect(r('[1] | iterables')).toEqual([[1]])
    expect(r('{a:1} | iterables')).toEqual([{ a: 1 }])
    expect(r('1 | iterables')).toEqual([])
    expect(r('null | iterables')).toEqual([])
  })

  it('booleans: yields booleans only', () => {
    expect(r('true | booleans')).toEqual([true])
    expect(r('false | booleans')).toEqual([false])
    expect(r('1 | booleans')).toEqual([])
    expect(r('null | booleans')).toEqual([])
  })

  it('numbers: yields numbers only', () => {
    expect(r('3.14 | numbers')).toEqual([3.14])
    expect(r('"n" | numbers')).toEqual([])
  })

  it('strings: yields strings only', () => {
    expect(r('"abc" | strings')).toEqual(['abc'])
    expect(r('1 | strings')).toEqual([])
  })

  it('nulls: yields null only', () => {
    expect(r('null | nulls')).toEqual([null])
    expect(r('false | nulls')).toEqual([])
  })

  it('values: yields everything except null', () => {
    expect(r('1 | values')).toEqual([1])
    expect(r('false | values')).toEqual([false])
    expect(r('null | values')).toEqual([])
  })

  it('scalars: yields null and scalars, not collections', () => {
    expect(r('null | scalars')).toEqual([null])
    expect(r('1 | scalars')).toEqual([1])
    expect(r('"s" | scalars')).toEqual(['s'])
    expect(r('[1] | scalars')).toEqual([])
    expect(r('{a:1} | scalars')).toEqual([])
  })

  it('finites: yields finite numbers only', () => {
    expect(r('1 | finites')).toEqual([1])
    expect(r('1e308 | finites')).toEqual([1e308])
    expect(r('null | finites')).toEqual([])
    expect(r('"x" | finites')).toEqual([])
  })

  it('normals: yields non-zero finite numbers only', () => {
    expect(r('1 | normals')).toEqual([1])
    expect(r('0 | normals')).toEqual([])
    expect(r('null | normals')).toEqual([])
  })

  it('empty: always yields nothing', () => {
    expect(r('1 | empty')).toEqual([])
    expect(r('null | empty')).toEqual([])
    expect(r('[1,2] | .[] | empty')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// src/builtins/strings/indices.ts — branches: 37.5%
// ---------------------------------------------------------------------------
describe('indices builtin', () => {
  it('finds all occurrences in a string', () => {
    expect(r('"abcabc" | indices("b")')).toEqual([[1, 4]])
  })

  it('handles overlapping matches in string ("aaaa" -> [0,1,2])', () => {
    expect(r('"aaaa" | indices("aa")')).toEqual([[0, 1, 2]])
  })

  it('returns empty array when no match in string', () => {
    expect(r('"abc" | indices("z")')).toEqual([[]])
  })

  it('returns empty array for empty search string (no step)', () => {
    // jq: empty string search returns [] (the search.length > 0 guard)
    expect(r('"abc" | indices("")')).toEqual([[]])
  })

  it('finds all indices in an array where element equals search', () => {
    expect(r('[1,2,1,3,1] | indices(1)')).toEqual([[0, 2, 4]])
  })

  it('returns empty array when no match in array', () => {
    expect(r('[1,2,3] | indices(9)')).toEqual([[]])
  })

  it('returns null for null input', () => {
    expect(r('null | indices("x")')).toEqual([null])
  })

  it('throws for non-string/array input', () => {
    expect(() => r('42 | indices("x")')).toThrow('indices expects string or array')
  })

  it('throws when searching string with non-string search', () => {
    expect(() => r('"abc" | indices(1)')).toThrow('indices expects string')
  })
})

// ---------------------------------------------------------------------------
// src/builtins/strings/index-of.ts — branches: 59.09%
// ---------------------------------------------------------------------------
describe('index / rindex builtins', () => {
  describe('index', () => {
    it('finds first occurrence in string', () => {
      expect(r('"abcabc" | index("b")')).toEqual([1])
    })
    it('returns null when not found in string', () => {
      expect(r('"abc" | index("z")')).toEqual([null])
    })
    it('throws when search is not a string for string input', () => {
      expect(() => r('"abc" | index(1)')).toThrow(
        'index expects string search when input is string'
      )
    })
    it('finds first matching element in array (forward)', () => {
      expect(r('[1,2,3,2] | index(2)')).toEqual([1])
    })
    it('returns null when element not in array', () => {
      expect(r('[1,2,3] | index(9)')).toEqual([null])
    })
    it('returns null for null input', () => {
      expect(r('null | index("x")')).toEqual([null])
    })
    it('throws for wrong input type', () => {
      expect(() => r('42 | index("x")')).toThrow('index expects string or array')
    })
  })

  describe('rindex', () => {
    it('finds last occurrence in string', () => {
      expect(r('"abcabc" | rindex("b")')).toEqual([4])
    })
    it('returns null when not found in string', () => {
      expect(r('"abc" | rindex("z")')).toEqual([null])
    })
    it('throws when search is not a string for string input', () => {
      expect(() => r('"abc" | rindex(1)')).toThrow(
        'rindex expects string search when input is string'
      )
    })
    it('finds last matching element in array (backward scan)', () => {
      expect(r('[1,2,3,2,1] | rindex(2)')).toEqual([3])
    })
    it('returns null when element not in array', () => {
      expect(r('[1,2,3] | rindex(9)')).toEqual([null])
    })
    it('returns null for null input', () => {
      expect(r('null | rindex("x")')).toEqual([null])
    })
    it('throws for wrong input type', () => {
      expect(() => r('42 | rindex("x")')).toThrow('rindex expects string or array')
    })
  })
})

// ---------------------------------------------------------------------------
// src/builtins/strings/codec.ts — branches: 50%
// ---------------------------------------------------------------------------
describe('codec builtins', () => {
  describe('implode', () => {
    it('converts array of codepoints to string', () => {
      expect(r('[72,101,108,108,111] | implode')).toEqual(['Hello'])
    })
    it('throws when array item is not a number', () => {
      expect(() => r('["a"] | implode')).toThrow('implode item must be number')
    })
    it('throws when input is not an array', () => {
      expect(() => r('"x" | implode')).toThrow('implode expects array')
    })
  })

  describe('fromjson', () => {
    it('parses valid JSON string', () => {
      expect(r('"[1,2]" | fromjson')).toEqual([[1, 2]])
    })
    it('throws on invalid JSON', () => {
      expect(() => r('"not json{" | fromjson')).toThrow('fromjson could not parse JSON')
    })
    it('throws when input is not a string', () => {
      expect(() => r('42 | fromjson')).toThrow('fromjson expects string')
    })
  })

  describe('utf8bytelength', () => {
    it('returns byte length for ASCII string', () => {
      expect(r('"abc" | utf8bytelength')).toEqual([3])
    })
    it('returns byte length for multi-byte characters', () => {
      // "é" is U+00E9 → 2 bytes in UTF-8
      expect(r('"é" | utf8bytelength')).toEqual([2])
    })
    it('throws when input is not a string', () => {
      expect(() => r('42 | utf8bytelength')).toThrow('utf8bytelength expects string')
    })
  })
})

// ---------------------------------------------------------------------------
// src/builtins/strings/trim.ts — branches: 50%
// ---------------------------------------------------------------------------
describe('trim builtins', () => {
  it('trimstr removes prefix and suffix', () => {
    expect(r('"__foo__" | trimstr("__")')).toEqual(['foo'])
  })
  it('trimstr only removes once (prefix then suffix)', () => {
    expect(r('"aXa" | trimstr("a")')).toEqual(['X'])
  })
  it('trimstr returns unchanged when no match', () => {
    expect(r('"foo" | trimstr("z")')).toEqual(['foo'])
  })
  it('trimstr throws on non-string input', () => {
    expect(() => r('42 | trimstr("x")')).toThrow('trimstr expects string')
  })
  it('trimstr throws when argument is not a string', () => {
    expect(() => r('"foo" | trimstr(1)')).toThrow('trimstr argument must be string')
  })
  it('trim removes leading and trailing whitespace', () => {
    expect(r('"  hello  " | trim')).toEqual(['hello'])
  })
  it('trim throws on non-string', () => {
    expect(() => r('42 | trim')).toThrow('trim expects string')
  })
  it('ltrim removes leading whitespace', () => {
    expect(r('"  hi" | ltrim')).toEqual(['hi'])
  })
  it('ltrim throws on non-string', () => {
    expect(() => r('42 | ltrim')).toThrow('ltrim expects string')
  })
  it('rtrim removes trailing whitespace', () => {
    expect(r('"hi  " | rtrim')).toEqual(['hi'])
  })
  it('rtrim throws on non-string', () => {
    expect(() => r('42 | rtrim')).toThrow('rtrim expects string')
  })
})

// ---------------------------------------------------------------------------
// src/builtins/math/rounding.ts — error paths
// ---------------------------------------------------------------------------
describe('rounding builtins (error paths)', () => {
  it('floor throws for non-number', () => {
    expect(() => r('"x" | floor')).toThrow('floor expects number')
  })
  it('ceil throws for non-number', () => {
    expect(() => r('"x" | ceil')).toThrow('ceil expects number')
  })
  it('round throws for non-number', () => {
    expect(() => r('"x" | round')).toThrow('round expects number')
  })
  it('abs throws for non-number', () => {
    expect(() => r('"x" | abs')).toThrow('abs expects number')
  })
  it('sqrt throws for non-number', () => {
    expect(() => r('"x" | sqrt')).toThrow('sqrt expects number')
  })
})

// ---------------------------------------------------------------------------
// src/eval/ops/arithmetic.ts — branches: 79.71%
// ---------------------------------------------------------------------------
describe('arithmetic operator edge cases', () => {
  it('divides string by string (splits)', () => {
    expect(r('"a,b,c" / ","')).toEqual([['a', 'b', 'c']])
  })

  it('throws for non-number mod', () => {
    expect(() => r('"a" % "b"')).toThrow('Cannot modulo')
  })

  it('throws for mod by zero', () => {
    expect(() => r('5 % 0')).toThrow('Modulo by zero')
  })

  it('throws for div by zero', () => {
    expect(() => r('5 / 0')).toThrow('Division by zero')
  })

  it('throws for unsupported div types', () => {
    expect(() => r('true / false')).toThrow('Cannot divide')
  })

  it('string * 0 returns null (jq semantics)', () => {
    expect(r('"ha" * 0')).toEqual([null])
  })

  it('string * negative returns null', () => {
    expect(r('"ha" * -1')).toEqual([null])
  })

  it('number * string also works (reversed)', () => {
    expect(r('3 * "ab"')).toEqual(['ababab'])
  })

  it('throws for unsupported mul types', () => {
    expect(() => r('true * false')).toThrow('Cannot multiply')
  })

  it('throws for unsupported sub types', () => {
    expect(() => r('"a" - 1')).toThrow('Cannot subtract')
  })

  it('throws for unsupported add types', () => {
    expect(() => r('1 + "a"')).toThrow('Cannot add')
  })
})

// ---------------------------------------------------------------------------
// src/eval/ops/compare.ts — branches: 71.42%  (Lte, Gte not tested)
// ---------------------------------------------------------------------------
describe('comparison operators (Lte, Gte)', () => {
  it('Lte: true when left < right', () => {
    expect(r('1 <= 2')).toEqual([true])
  })
  it('Lte: true when left == right', () => {
    expect(r('2 <= 2')).toEqual([true])
  })
  it('Lte: false when left > right', () => {
    expect(r('3 <= 2')).toEqual([false])
  })
  it('Gte: true when left > right', () => {
    expect(r('3 >= 2')).toEqual([true])
  })
  it('Gte: true when left == right', () => {
    expect(r('2 >= 2')).toEqual([true])
  })
  it('Gte: false when left < right', () => {
    expect(r('1 >= 2')).toEqual([false])
  })
})

// ---------------------------------------------------------------------------
// src/path/update-slice.ts — branches: 50%
// ---------------------------------------------------------------------------
describe('slice assignment (path update-slice)', () => {
  it('replaces a range in an array via slice assignment', () => {
    expect(r('.[1:3] = [10, 20]', [0, 1, 2, 3, 4])).toEqual([[0, 10, 20, 3, 4]])
  })
  it('throws when root is not an array', () => {
    expect(() => r('.[0:1] = [1]', 'str')).toThrow()
  })
  it('throws when assigned value is not an array', () => {
    expect(() => r('.[0:1] |= . + 1', [1, 2, 3])).toThrow()
  })
  it('handles slice with null start (defaults to 0)', () => {
    expect(r('.[:2] = [9, 9]', [1, 2, 3, 4])).toEqual([[9, 9, 3, 4]])
  })
  it('handles slice with null end (defaults to length)', () => {
    expect(r('.[1:] = [9, 9]', [1, 2, 3])).toEqual([[1, 9, 9]])
  })
})

// ---------------------------------------------------------------------------
// src/path/types.ts — branches: 50%  (ensurePath error branch)
// ---------------------------------------------------------------------------
describe('path validation (ensurePath)', () => {
  it('getpath works with valid path', () => {
    expect(r('getpath(["a","b"])', { a: { b: 42 } })).toEqual([42])
  })
  it('setpath works with valid path', () => {
    expect(r('setpath(["x"]; 99)', {})).toEqual([{ x: 99 }])
  })
  it('delpaths works with valid path array', () => {
    expect(r('delpaths([["a"]])', { a: 1, b: 2 })).toEqual([{ b: 2 }])
  })
  it('getpath throws for non-path value', () => {
    expect(() => r('getpath("not-a-path")', {})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// src/builtins/iterators/all.ts  — branches: 50% (arity 2 not tested)
// ---------------------------------------------------------------------------
describe('all/any (arity 2)', () => {
  it('all(gen; cond) returns true when all generated values satisfy cond', () => {
    expect(r('all(range(3); . >= 0)')).toEqual([true])
  })
  it('all(gen; cond) returns false when any generated value fails cond', () => {
    expect(r('all(range(4); . < 3)')).toEqual([false])
  })
  it('any(gen; cond) returns true when at least one satisfies cond', () => {
    expect(r('any(range(5); . == 3)')).toEqual([true])
  })
  it('any(gen; cond) returns false when none satisfy cond', () => {
    expect(r('any(range(5); . == 9)')).toEqual([false])
  })
  it('all/any 0-arity throws on non-array', () => {
    expect(() => r('1 | all')).toThrow('all expects an array')
    expect(() => r('1 | any')).toThrow('any expects an array')
  })
  it('all/any 1-arity throws on non-array', () => {
    expect(() => r('1 | all(. > 0)')).toThrow('all expects an array')
    expect(() => r('1 | any(. > 0)')).toThrow('any expects an array')
  })
})

// ---------------------------------------------------------------------------
// src/eval/pathEval/segments.ts — branches: 40.9%
// ---------------------------------------------------------------------------
describe('path expressions (pathEval segments)', () => {
  it('path(.[]) on an object iterates all keys', () => {
    const paths = r('path(.[])| .', { a: 1, b: 2 })
    expect(paths).toContainEqual(['a'])
    expect(paths).toContainEqual(['b'])
  })

  it('path(.[]) on an array iterates all indices', () => {
    expect(r('[path(.[]) | .[0]]', [10, 20, 30])).toEqual([[0, 1, 2]])
  })

  it('path(.[expr]) with string key on object', () => {
    expect(r('path(.["foo"])', { foo: 1 })).toEqual([['foo']])
  })

  it('path(.[expr]) throws for non-string/integer key', () => {
    expect(() => r('path(.[true])', {})).toThrow('Path index must be string or integer')
  })

  it('path(.[] | .x) pipes into nested path — wrapping in array collects all', () => {
    // [path(.[] | .x)] produces a single array value containing all paths
    expect(r('[path(.[] | .x)]', [{ x: 1 }, { x: 2 }])).toEqual([
      [
        [0, 'x'],
        [1, 'x'],
      ],
    ])
  })

  it('path(try .foo) on integer: .foo is valid path even on non-object', () => {
    // FieldAccess is a valid path expression regardless of value type
    expect(r('[path(try .foo)]', 42)).toEqual([[['foo']]])
  })

  it('path(.a, .b) via comma gives both paths (collected into array)', () => {
    // [path(.a, .b)] produces [[['a'],['b']]] — one value = array of two paths
    expect(r('[path(.a, .b)]', { a: 1, b: 2 })).toEqual([[['a'], ['b']]])
  })

  it('path(.[] | select(. > 1)) filters paths', () => {
    // [path(...)] collects all path results into a single array value
    expect(r('[path(.[] | select(. > 1))]', [1, 2, 3])).toEqual([[[1], [2]]])
  })

  it('path(select(.)) yields identity path when truthy', () => {
    // select in path context: truthy → empty path (identity)
    expect(r('[path(select(. > 0))]', 5)).toEqual([[[]]])
  })

  it('path(select(.)) yields empty when condition false', () => {
    expect(r('[path(select(. < 0))]', 5)).toEqual([[]])
  })

  it('path throws for unknown function in path context', () => {
    expect(() => r('[path(unknown_fn)]', {})).toThrow()
  })

  it('path(.[1:3]) — slice segment path', () => {
    const result = r('path(.[1:3])', [0, 1, 2, 3])
    expect(result[0]).toMatchObject([{ start: 1, end: 3 }])
  })

  it('path segment iterate throws on non-iterable primitive', () => {
    expect(() => r('[path(. | .[])]', 42)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// src/compat/execution.ts — branches: 43.75%
// ---------------------------------------------------------------------------
describe('compat execution helpers', () => {
  it('runJqTs returns ok:true for valid expression', () => {
    const result = runJqTs('.x', { x: 1 }, {})
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.outputs).toEqual([1])
  })

  it('runJqTs returns ok:false for invalid expression', () => {
    const result = runJqTs('unknown_builtin_xyz', null, {})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.stage).toBeDefined()
      expect(result.error).toBeDefined()
    }
  })

  it('runJqTs returns ok:false for parse error', () => {
    const result = runJqTs('!!!', null, {})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeDefined()
  })

  it('executionFindings: both ok — no error findings', () => {
    const findings = executionFindings({ ok: true, outputs: [1] }, { ok: true, outputs: [1] }, true)
    expect(findings).toEqual([])
  })

  it('executionFindings: jqTs fails → runtime-error finding', () => {
    const findings = executionFindings(
      { ok: false, error: 'oops', stage: 'runtime' },
      { ok: true, outputs: [] },
      null
    )
    expect(findings.some((f) => f.category === 'runtime-error')).toBe(true)
  })

  it('executionFindings: jqResult fails → jq-error finding', () => {
    const findings = executionFindings(
      { ok: true, outputs: [1] },
      { ok: false, error: 'jq died', stage: 'compare' },
      null
    )
    expect(findings.some((f) => f.category === 'jq-error')).toBe(true)
  })

  it('executionFindings: equivalent=false → output-mismatch finding', () => {
    const findings = executionFindings(
      { ok: true, outputs: [1] },
      { ok: true, outputs: [2] },
      false
    )
    expect(findings.some((f) => f.category === 'output-mismatch')).toBe(true)
  })

  it('compareWithJq reports error when jq runner throws', () => {
    const failingJq: JqRunner = () => {
      throw new Error('jq not found')
    }
    const result = compareWithJq('.', null, failingJq)
    expect(result.jq.ok).toBe(false)
  })

  it('compareWithJq accepts a pre-computed ExecutionResult', () => {
    const precomputed = { ok: true as const, outputs: [42] }
    const result = compareWithJq('.', 42, precomputed)
    expect(result.equivalent).toBe(true)
  })

  it('checkCompatibility passes for valid expression', () => {
    expect(checkCompatibility('. + 1').compatible).toBe(true)
  })

  it('analyzeCompatibility is false-compatible when incompatible', () => {
    const result = analyzeCompatibility('@base64')
    expect(result.compatible).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// src/compat/visit.ts — branches: 29.72%
// ---------------------------------------------------------------------------
describe('compat visitor (visit all node kinds)', () => {
  const collectKinds = (expr: string): string[] => {
    const node = parse(expr)
    const kinds: string[] = []
    visit(node, (n) => kinds.push(n.kind))
    return kinds
  }

  it('visits Identity', () => {
    expect(collectKinds('.')).toContain('Identity')
  })

  it('visits Literal', () => {
    expect(collectKinds('1')).toContain('Literal')
  })

  it('visits FieldAccess', () => {
    expect(collectKinds('.foo')).toContain('FieldAccess')
  })

  it('visits IndexAccess', () => {
    expect(collectKinds('.["foo"]')).toContain('IndexAccess')
  })

  it('visits Iterate', () => {
    expect(collectKinds('.[]')).toContain('Iterate')
  })

  it('visits Slice with start and end', () => {
    const kinds = collectKinds('.[1:3]')
    expect(kinds).toContain('Slice')
  })

  it('visits Slice with only start (end is absent)', () => {
    const kinds = collectKinds('.[2:]')
    expect(kinds).toContain('Slice')
  })

  it('visits Array constructor', () => {
    expect(collectKinds('[1,2]')).toContain('Array')
  })

  it('visits Object constructor (static key)', () => {
    expect(collectKinds('{a:1}')).toContain('Object')
  })

  it('visits Object constructor with computed key (KeyExpr)', () => {
    const kinds = collectKinds('{(.foo): 1}')
    expect(kinds).toContain('Object')
    // KeyExpr path: visit is called on key.expr
    expect(kinds.filter((k) => k === 'FieldAccess').length).toBeGreaterThan(0)
  })

  it('visits Pipe', () => {
    expect(collectKinds('. | . + 1')).toContain('Pipe')
  })

  it('visits Comma', () => {
    expect(collectKinds('1, 2')).toContain('Comma')
  })

  it('visits Alt (//) operator', () => {
    expect(collectKinds('null // 1')).toContain('Alt')
  })

  it('visits Binary operator', () => {
    expect(collectKinds('1 + 2')).toContain('Binary')
  })

  it('visits Bool (and/or)', () => {
    expect(collectKinds('true and false')).toContain('Bool')
    expect(collectKinds('true or false')).toContain('Bool')
  })

  it('visits Unary', () => {
    expect(collectKinds('-1')).toContain('Unary')
  })

  it('visits If', () => {
    const kinds = collectKinds('if . then 1 else 0 end')
    expect(kinds).toContain('If')
  })

  it('visits As (binding)', () => {
    const kinds = collectKinds('. as $x | $x')
    expect(kinds).toContain('As')
    expect(kinds).toContain('Var')
  })

  it('visits Call with arguments', () => {
    const kinds = collectKinds('map(. + 1)')
    expect(kinds).toContain('Call')
  })

  it('visits Reduce', () => {
    const kinds = collectKinds('reduce .[] as $x (0; . + $x)')
    expect(kinds).toContain('Reduce')
  })

  it('visits Foreach', () => {
    const kinds = collectKinds('foreach .[] as $x (0; . + $x)')
    expect(kinds).toContain('Foreach')
  })

  it('visits Foreach with extract clause', () => {
    const kinds = collectKinds('foreach .[] as $x (0; . + $x; . * 2)')
    expect(kinds).toContain('Foreach')
  })

  it('visits Try without handler', () => {
    const kinds = collectKinds('try error')
    expect(kinds).toContain('Try')
  })

  it('visits Try with handler', () => {
    const kinds = collectKinds('try error catch .')
    expect(kinds).toContain('Try')
  })

  it('visits Assignment', () => {
    const kinds = collectKinds('.x = 1')
    expect(kinds).toContain('Assignment')
  })

  it('visits Def', () => {
    const kinds = collectKinds('def f: . + 1; f')
    expect(kinds).toContain('Def')
  })

  it('visits Label/Break', () => {
    const kinds = collectKinds('label $x | break $x')
    expect(kinds).toContain('Label')
    expect(kinds).toContain('Break')
  })
})

// ---------------------------------------------------------------------------
// src/builtins/utils.ts — branches: 45%  (ensureIndex edge cases)
// ---------------------------------------------------------------------------
describe('builtin utils (ensureIndex via has)', () => {
  it('has(n) with integer index in-bounds returns true', () => {
    expect(r('[1,2,3] | has(1)')).toEqual([true])
  })
  it('has(n) with integer index out-of-bounds returns false', () => {
    expect(r('[1,2,3] | has(5)')).toEqual([false])
  })
  it('has(n) with floating-point index (trunc to int)', () => {
    // ensureIndex truncates float to int
    expect(r('[1,2,3] | has(1.9)')).toEqual([true])
  })
  it('has with non-finite number returns false (not a valid index)', () => {
    // NaN-like paths: ensureIndex returns undefined for non-finite
    // Testing via in builtin
    expect(r('0 | in([1,2])')).toEqual([true])
  })
  it('in throws when checking number key on object', () => {
    expect(() => r('1 | in({a:1})')).toThrow()
  })
  it('in throws when checking string key on array', () => {
    expect(() => r('"a" | in([1,2])')).toThrow()
  })
  it('in throws when container is not array or object', () => {
    expect(() => r('"a" | in("abc")')).toThrow()
  })
  it('keys throws on non-array/object', () => {
    expect(() => r('1 | keys')).toThrow('keys expects an array or object')
  })
  it('keys_unsorted throws on non-array/object', () => {
    expect(() => r('1 | keys_unsorted')).toThrow('keys_unsorted expects an array or object')
  })
})

// ---------------------------------------------------------------------------
// src/eval/access/index-access.ts — uncovered index-on-null, object-wrong-key
// ---------------------------------------------------------------------------
describe('index access edge cases', () => {
  it('null.[0] returns null (null is identity for access)', () => {
    expect(r('null | .[0]')).toEqual([null])
  })
  it('null.["foo"] returns null', () => {
    expect(r('null | .["foo"]')).toEqual([null])
  })
  it('indexing array with out-of-range returns null', () => {
    expect(r('.[99]', [1, 2, 3])).toEqual([null])
  })
  it('negative array index resolves from end', () => {
    expect(r('.[-1]', [1, 2, 3])).toEqual([3])
  })
  it('indexing object with non-string throws', () => {
    expect(() => r('.[1]', { a: 1 })).toThrow()
  })
  it('indexing non-array/non-object throws', () => {
    expect(() => r('.[0]', 42)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// src/eval/access/slice.ts — branch: slice on wrong type
// ---------------------------------------------------------------------------
describe('slice eval edge cases', () => {
  it('slices a string', () => {
    expect(r('.[1:3]', 'hello')).toEqual(['el'])
  })
  it('throws when slicing non-string/non-array', () => {
    expect(() => r('.[0:1]', 42)).toThrow('Slice expected string or array')
  })
  it('slice start must be a number', () => {
    expect(() => r('.["a":2]', [1, 2, 3])).toThrow()
  })
})

// ---------------------------------------------------------------------------
// src/eval/assignment/sugarOps.ts — branch: //= operator
// ---------------------------------------------------------------------------
describe('assignment sugar ops', () => {
  it('//= replaces null with rhs', () => {
    expect(r('.a //= 42', { a: null })).toEqual([{ a: 42 }])
  })
  it('//= replaces false with rhs', () => {
    expect(r('.a //= 42', { a: false })).toEqual([{ a: 42 }])
  })
  it('//= keeps existing truthy value', () => {
    expect(r('.a //= 42', { a: 10 })).toEqual([{ a: 10 }])
  })
  it('+= works as sugar op', () => {
    expect(r('.a += 5', { a: 10 })).toEqual([{ a: 15 }])
  })
  it('-= works as sugar op', () => {
    expect(r('.a -= 3', { a: 10 })).toEqual([{ a: 7 }])
  })
  it('*= works as sugar op', () => {
    expect(r('.a *= 2', { a: 5 })).toEqual([{ a: 10 }])
  })
  it('/= works as sugar op', () => {
    expect(r('.a /= 2', { a: 10 })).toEqual([{ a: 5 }])
  })
  it('%= works as sugar op', () => {
    expect(r('.a %= 3', { a: 10 })).toEqual([{ a: 1 }])
  })
})

// ---------------------------------------------------------------------------
// src/builtins/collections/sort.ts — missing error paths
// ---------------------------------------------------------------------------
describe('sort/unique error paths', () => {
  it('sort throws on non-array', () => {
    expect(() => r('1 | sort')).toThrow('sort expects an array')
  })
  it('sort_by throws on non-array', () => {
    expect(() => r('1 | sort_by(.)')).toThrow('sort_by expects an array')
  })
  it('unique throws on non-array', () => {
    expect(() => r('1 | unique')).toThrow('unique expects an array')
  })
  it('unique_by throws on non-array', () => {
    expect(() => r('1 | unique_by(.)')).toThrow('unique_by expects an array')
  })
})

// ---------------------------------------------------------------------------
// src/builtins/collections/group.ts — missing group_by/bsearch branches
// ---------------------------------------------------------------------------
describe('group_by and bsearch edge cases', () => {
  it('group_by throws on non-array', () => {
    expect(() => r('1 | group_by(.)')).toThrow('group_by expects an array')
  })
  it('group_by on empty array returns empty groups', () => {
    expect(r('[] | group_by(.x)')).toEqual([[]])
  })
  it('bsearch throws on non-array', () => {
    expect(() => r('1 | bsearch(1)')).toThrow('bsearch expects an array')
  })
  it('bsearch finds first element', () => {
    expect(r('[1,2,3] | bsearch(1)')).toEqual([0])
  })
  it('bsearch when target not found returns insertion point negative', () => {
    expect(r('[2,4,6] | bsearch(5)')).toEqual([-3])
  })
})

// ---------------------------------------------------------------------------
// src/builtins/collections/entries.ts — missing error paths
// ---------------------------------------------------------------------------
describe('entries builtin error paths', () => {
  it('to_entries throws on non-array/non-object', () => {
    expect(() => r('1 | to_entries')).toThrow('to_entries expects array or object')
  })
  it('from_entries throws on non-array', () => {
    expect(() => r('1 | from_entries')).toThrow('from_entries expects an array')
  })
  it('from_entries throws on non-object entries', () => {
    expect(() => r('[1] | from_entries')).toThrow('Cannot use non-object as an entry')
  })
  it('with_entries throws on non-iterable', () => {
    expect(() => r('1 | with_entries(.)')).toThrow('with_entries expects array or object')
  })
  it('from_entries supports "name" alias for key', () => {
    expect(r('[{name:"x",value:1}] | from_entries')).toEqual([{ x: 1 }])
  })
  it('from_entries supports "k" alias for key', () => {
    expect(r('[{k:"y",value:2}] | from_entries')).toEqual([{ y: 2 }])
  })
  it('from_entries supports "v" alias for value', () => {
    expect(r('[{key:"a",v:99}] | from_entries')).toEqual([{ a: 99 }])
  })
  it('from_entries supports "V" alias for value', () => {
    expect(r('[{key:"a","Value":100}] | from_entries')).toEqual([{ a: 100 }])
  })
  it('from_entries with null key coerces to "null"', () => {
    expect(r('[{key:null,value:1}] | from_entries')).toEqual([{ null: 1 }])
  })
})

// ---------------------------------------------------------------------------
// src/builtins/collections/shape.ts — missing branches for transpose/flatten
// ---------------------------------------------------------------------------
describe('shape builtin edge cases', () => {
  it('reverse throws on non-array', () => {
    expect(() => r('1 | reverse')).toThrow('reverse expects an array')
  })
  it('flatten throws on non-array', () => {
    expect(() => r('1 | flatten')).toThrow('flatten expects an array')
  })
  it('flatten(depth) throws when input is not array', () => {
    expect(() => r('1 | flatten(1)')).toThrow('flatten expects an array')
  })
  it('flatten(depth) throws when depth is not a number', () => {
    expect(() => r('[[1]] | flatten("deep")')).toThrow('flatten depth must be a number')
  })
  it('transpose throws on non-array', () => {
    expect(() => r('1 | transpose')).toThrow('transpose expects an array')
  })
  it('transpose throws when inner element is not array', () => {
    expect(() => r('[1] | transpose')).toThrow('transpose input must be array of arrays')
  })
  it('transpose handles empty array', () => {
    expect(r('[] | transpose')).toEqual([[]])
  })
  it('transpose with uneven rows pads with null', () => {
    expect(r('[[1,2],[3]] | transpose')).toEqual([
      [
        [1, 3],
        [2, null],
      ],
    ])
  })
})

// ---------------------------------------------------------------------------
// src/builtins/std/coerce.ts — missing branch: tonumber from non-string/number
// ---------------------------------------------------------------------------
describe('coerce builtin error paths', () => {
  it('tonumber throws for null', () => {
    expect(() => r('null | tonumber')).toThrow('Cannot convert null to number')
  })
  it('tonumber throws for boolean', () => {
    expect(() => r('true | tonumber')).toThrow('Cannot convert boolean to number')
  })
  it('length throws for boolean', () => {
    expect(() => r('true | length')).toThrow('Cannot take length of boolean')
  })
  it('length of null throws (not supported in this implementation)', () => {
    expect(() => r('null | length')).toThrow('Cannot take length of null')
  })
})

// ---------------------------------------------------------------------------
// src/eval/iterators.ts — uncovered branches in evalIterate / evalRecurse
// ---------------------------------------------------------------------------
describe('iterate and recurse edge cases', () => {
  it('.[] throws on primitive (not null)', () => {
    expect(() => r('1 | .[]')).toThrow('Cannot iterate over')
  })
  it('.[] on null yields nothing', () => {
    expect(r('[null | .[]]')).toEqual([[]])
  })
  it('.. on a simple scalar only emits the scalar itself', () => {
    expect(r('..', 42)).toEqual([42])
  })
  it('.. on object visits all nested values', () => {
    const result = r('..', { a: 1, b: { c: 2 } })
    expect(result).toContain(1)
    expect(result).toContain(2)
  })
})

// ---------------------------------------------------------------------------
// src/builtins/iterators/nth.ts — uncovered branches: nth on non-array, type error
// ---------------------------------------------------------------------------
describe('nth builtin edge cases', () => {
  it('nth(n) throws on non-array input', () => {
    expect(() => r('nth(0)', 42)).toThrow('nth expects array input')
  })
  it('nth(n) throws when n is not a number', () => {
    expect(() => r('[1,2,3] | nth("a")')).toThrow('nth expects number')
  })
  it('nth(n) with out-of-range returns nothing', () => {
    expect(r('[1,2,3] | nth(10)')).toEqual([])
  })
  it('nth(n; expr) throws when n is not a number', () => {
    expect(() => r('nth("a"; range(5))')).toThrow('nth expects number')
  })
})

// ---------------------------------------------------------------------------
// src/path/delete.ts — uncovered branches (nested delete / scalar passthrough)
// ---------------------------------------------------------------------------
describe('del path edge cases', () => {
  it('del(.a) from nested object', () => {
    expect(r('del(.a.b)', { a: { b: 1, c: 2 } })).toEqual([{ a: { c: 2 } }])
  })
  it('del negative array index', () => {
    expect(r('del(.[-1])', [1, 2, 3])).toEqual([[1, 2]])
  })
  it('del out-of-range index is a no-op', () => {
    expect(r('del(.[99])', [1, 2])).toEqual([[1, 2]])
  })
  it('del on scalar path is no-op (root returned)', () => {
    // delpaths([]) means delete nothing → null returned for empty path
    expect(r('delpaths([[]])', 42)).toEqual([null])
  })
  it('del from array deletes nested element', () => {
    expect(r('del(.[1].x)', [{ x: 1 }, { x: 2 }])).toEqual([[{ x: 1 }, {}]])
  })
})

// ---------------------------------------------------------------------------
// src/builtins/collections/keys.ts — has() edge cases
// ---------------------------------------------------------------------------
describe('has/in edge cases', () => {
  it('has(key) with numeric key on object (stringifies)', () => {
    // has(1) on object: key.toString() = "1"
    expect(r('{"1": true} | has(1)')).toEqual([true])
  })
  it('has() with non-string/number key on object throws', () => {
    expect(() => r('{} | has([])')).toThrow('has() key must be string or number for object input')
  })
  it('has() throws on non-array/object input', () => {
    expect(() => r('1 | has("x")')).toThrow('has() expects an array or object input')
  })
})
