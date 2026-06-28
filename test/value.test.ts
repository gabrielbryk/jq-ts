import { describe, expect, it } from 'vitest'
import { compareValues, valueEquals, type Value } from '../src/value'

describe('compareValues', () => {
  it('orders values across types as null < false < true < numbers < strings < arrays < objects', () => {
    const ordered: Value[] = [null, false, true, 42, 'hello', [1, 2], { a: 1 }]
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = 0; j < ordered.length; j += 1) {
        const expected = i < j ? -1 : i > j ? 1 : 0
        expect(compareValues(ordered[i]!, ordered[j]!)).toBe(expected)
      }
    }
  })

  it('orders numbers numerically', () => {
    expect(compareValues(1, 2)).toBe(-1)
    expect(compareValues(2, 1)).toBe(1)
    expect(compareValues(2, 2)).toBe(0)
    expect(compareValues(-5, 0)).toBe(-1)
    expect(compareValues(1.5, 1.25)).toBe(1)
  })

  it('orders strings lexicographically', () => {
    expect(compareValues('a', 'b')).toBe(-1)
    expect(compareValues('b', 'a')).toBe(1)
    expect(compareValues('abc', 'abc')).toBe(0)
    expect(compareValues('abc', 'abd')).toBe(-1)
    expect(compareValues('ab', 'abc')).toBe(-1)
  })

  it('orders arrays lexicographically by element', () => {
    expect(compareValues([1, 2, 3], [1, 2, 4])).toBe(-1)
    expect(compareValues([1, 2], [1, 2, 3])).toBe(-1)
    expect(compareValues([1, 2, 3], [1, 2])).toBe(1)
    expect(compareValues([], [1])).toBe(-1)
    expect(compareValues([1, 2], [1, 2])).toBe(0)
  })

  it('orders objects by sorted key set then by value', () => {
    expect(compareValues({ a: 1 }, { b: 1 })).toBe(-1)
    expect(compareValues({ a: 1 }, { a: 2 })).toBe(-1)
    expect(compareValues({ a: 1 }, { a: 1, b: 2 })).toBe(-1)
    expect(compareValues({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(0)
  })

  it('ignores object insertion order when comparing', () => {
    expect(compareValues({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(0)
  })

  it('compares nested structures recursively', () => {
    expect(compareValues([{ a: [1] }], [{ a: [2] }])).toBe(-1)
    expect(compareValues({ a: [1, 2] }, { a: [1, 3] })).toBe(-1)
  })
})

describe('valueEquals', () => {
  it('treats matching primitives as equal', () => {
    expect(valueEquals(null, null)).toBe(true)
    expect(valueEquals(true, true)).toBe(true)
    expect(valueEquals(1, 1)).toBe(true)
    expect(valueEquals('x', 'x')).toBe(true)
  })

  it('treats differing primitives or types as unequal', () => {
    expect(valueEquals(1, 2)).toBe(false)
    expect(valueEquals(true, false)).toBe(false)
    expect(valueEquals(null, false)).toBe(false)
    expect(valueEquals(1, '1')).toBe(false)
    expect(valueEquals(0, null)).toBe(false)
  })

  it('treats NaN as equal to itself via Object.is', () => {
    expect(valueEquals(NaN, NaN)).toBe(true)
  })

  it('distinguishes +0 and -0 via Object.is', () => {
    expect(valueEquals(0, -0)).toBe(false)
  })

  it('compares arrays deeply', () => {
    expect(valueEquals([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(valueEquals([1, 2], [1, 2, 3])).toBe(false)
    expect(valueEquals([1, 2, 3], [1, 2, 4])).toBe(false)
  })

  it('compares objects by key set and values, ignoring insertion order', () => {
    expect(valueEquals({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(valueEquals({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(valueEquals({ a: 1 }, { a: 2 })).toBe(false)
    expect(valueEquals({ a: 1 }, { b: 1 })).toBe(false)
  })

  it('compares nested structures deeply', () => {
    const a: Value = { x: [1, { y: 'z' }], w: [true, null] }
    const b: Value = { w: [true, null], x: [1, { y: 'z' }] }
    expect(valueEquals(a, b)).toBe(true)
    expect(valueEquals(a, { x: [1, { y: 'q' }], w: [true, null] })).toBe(false)
  })

  it('does not treat an array and object as equal', () => {
    expect(valueEquals([], {})).toBe(false)
  })
})
