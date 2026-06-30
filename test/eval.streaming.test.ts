import { describe, expect, it } from 'vitest'

import { run } from '../src'
import type { Value } from '../src/value'

const evalExpr = (expr: string, input: Value = null): Value[] => run(expr, input)

describe('eval streaming builtins', () => {
  describe('tostream', () => {
    it('streams a nested array with close events', () => {
      // jq: echo '[1,[2,3]]' | jq -c '[tostream]'
      expect(evalExpr('[tostream]', [1, [2, 3]])).toEqual([
        [[[0], 1], [[1, 0], 2], [[1, 1], 3], [[1, 1]], [[1]]],
      ])
    })

    it('streams a flat array', () => {
      expect(evalExpr('[tostream]', [1, 2, 3])).toEqual([[[[0], 1], [[1], 2], [[2], 3], [[2]]]])
    })

    it('streams an object with a single close event for the last key', () => {
      expect(evalExpr('[tostream]', { a: 1, b: 2 })).toEqual([[[['a'], 1], [['b'], 2], [['b']]]])
    })

    it('streams nested objects with per-container close events', () => {
      expect(evalExpr('[tostream]', { a: { b: 1, c: 2 }, d: 3 })).toEqual([
        [[['a', 'b'], 1], [['a', 'c'], 2], [['a', 'c']], [['d'], 3], [['d']]],
      ])
    })

    it('streams mixed arrays and objects', () => {
      expect(evalExpr('[tostream]', { a: [1, { b: 2 }] })).toEqual([
        [[['a', 0], 1], [['a', 1, 'b'], 2], [['a', 1, 'b']], [['a', 1]], [['a']]],
      ])
    })

    it('streams top-level scalars as a single leaf at path []', () => {
      expect(evalExpr('[tostream]', 42)).toEqual([[[[], 42]]])
      expect(evalExpr('[tostream]', null)).toEqual([[[[], null]]])
      expect(evalExpr('[tostream]', 'hi')).toEqual([[[[], 'hi']]])
    })

    it('treats empty containers as leaves', () => {
      expect(evalExpr('[tostream]', [])).toEqual([[[[], []]]])
      expect(evalExpr('[tostream]', {})).toEqual([[[[], {}]]])
    })
  })

  describe('fromstream', () => {
    it('round-trips tostream for arrays, objects, scalars and empties', () => {
      const inputs: Value[] = [
        [1, [2, 3]],
        { a: { b: 1, c: 2 }, d: 3 },
        42,
        [],
        {},
        { a: [1, { x: 2, y: [3, 4] }], b: 5 },
      ]
      for (const input of inputs) {
        expect(evalExpr('fromstream(tostream)', input)).toEqual([input])
      }
    })

    it('emits each completed top-level value once', () => {
      // jq: fromstream([[0],1],[[0]],[[0],"x"],[[0]]) -> [1] then ["x"]
      expect(evalExpr('[fromstream([[0],1],[[0]],[[0],"x"],[[0]])]')).toEqual([[[1], ['x']]])
    })

    it('reassembles a single top-level array from leaf + close events', () => {
      expect(evalExpr('[fromstream([[0],1],[[1],2],[[1]])]')).toEqual([[[1, 2]]])
    })

    it('flushes a top-level scalar event immediately', () => {
      expect(evalExpr('[fromstream([[],5])]')).toEqual([[5]])
    })

    it('emits nothing for an incomplete (unclosed) stream', () => {
      expect(evalExpr('[fromstream([[0],1])]')).toEqual([[]])
    })
  })

  describe('truncate_stream/1 (depth from input, jq 1.8.1 form)', () => {
    it('drops the first depth path elements and filters short events', () => {
      // jq: 1 | truncate_stream([[1,2],[3,4]] | tostream)
      expect(evalExpr('[1|truncate_stream([[1,2],[3,4]]|tostream)]')).toEqual([
        [[[0], 1], [[1], 2], [[1]], [[0], 3], [[1], 4], [[1]]],
      ])
    })

    it('drops events whose path length is not strictly greater than depth', () => {
      expect(evalExpr('[1|truncate_stream([[0],1],[[0]])]')).toEqual([[]])
      expect(evalExpr('[2|truncate_stream([[1,2],[3,4]]|tostream)]')).toEqual([[]])
    })

    it('truncates literal stream events', () => {
      expect(evalExpr('[1|truncate_stream([[0,0],1],[[0,0]])]')).toEqual([[[[0], 1], [[0]]]])
    })

    it('keeps long events and drops short ones in the same stream', () => {
      expect(evalExpr('[1|truncate_stream([[0,1],1],[[0,1]],[[0]])]')).toEqual([[[[1], 1], [[1]]]])
    })

    it('evaluates the stream argument against null, not the depth input', () => {
      // tostream runs on null here, so its only event has path [] and is dropped
      expect(
        evalExpr('[1|truncate_stream(tostream)]', [
          [1, 2],
          [3, 4],
        ])
      ).toEqual([[]])
    })
  })

  describe('truncate_stream/2 (explicit depth; extension, not in jq 1.8.1)', () => {
    it('truncates a stream evaluated against the current input', () => {
      expect(
        evalExpr('[truncate_stream(1; tostream)]', [
          [1, 2],
          [3, 4],
        ])
      ).toEqual([[[[0], 1], [[1], 2], [[1]], [[0], 3], [[1], 4], [[1]]]])
    })

    it('matches the /1 form for literal streams', () => {
      expect(evalExpr('[truncate_stream(1; [[0,0],1],[[0,0]])]')).toEqual([[[[0], 1], [[0]]]])
    })
  })
})
