import { describe, expect, it } from 'vitest'
import { run } from '../src/index'

describe('predefined variables and scoping', () => {
  describe('variable injection', () => {
    it('supports injecting global variables', () => {
      const result = run('$foo', null, { vars: { foo: 123 } })
      expect(result).toEqual([123])
    })

    it('supports multiple global variables', () => {
      const result = run('$foo + $bar', null, { vars: { foo: 1, bar: 2 } })
      expect(result).toEqual([3])
    })

    it('supports complex values in variables', () => {
      const result = run('$data.foo', null, { vars: { data: { foo: 'bar' } } })
      expect(result).toEqual(['bar'])
    })
  })

  describe('shadowing and scoping', () => {
    it('properly shadows global variables with "as"', () => {
      const result = run('$x, (1 as $x | $x), $x', null, { vars: { x: 9 } })
      expect(result).toEqual([9, 1, 9])
    })

    it('properly shadows global variables in reduce', () => {
      // Outer $x is 9. Reduce uses $x as iterator.
      // Inside reduce update, $x should be the current item.
      // After reduce, outer $x should still be 9.
      const result = run('$x, (reduce (1, 2) as $x (0; . + $x)), $x', null, { vars: { x: 9 } })
      expect(result).toEqual([9, 3, 9])
    })

    it('properly shadows variables in nested reduce', () => {
      const result = run('reduce (1, 2) as $x (0; . + (reduce (10, 20) as $x (0; . + $x)))', null)
      // Iteration 1: $x=1. Inner reduce (10, 20) as $x -> 30. Acc = 0 + 30 = 30.
      // Iteration 2: $x=2. Inner reduce (10, 20) as $x -> 30. Acc = 30 + 30 = 60.
      expect(result).toEqual([60])
    })

    it('properly shadows global variables in foreach', () => {
      const result = run('[$x, (foreach (1, 2) as $x (0; . + $x; .)), $x]', null, {
        vars: { x: 9 },
      })
      expect(result).toEqual([[9, 1, 3, 9]])
    })

    it('shorthand object syntax works with shadowed variables', () => {
      // This confirms that our recent shorthand object fix also respects the new scoping
      const result = run('$x | { x: $x }', null, { vars: { x: 9 } })
      expect(result).toEqual([{ x: 9 }])

      const result2 = run('1 as $x | { x: $x }', null, { vars: { x: 9 } })
      expect(result2).toEqual([{ x: 1 }])
    })

    it('preserves outer bindings even if inner scope fails or produces multiple values', () => {
      // Multiple values in body
      const result = run('$x, (1 as $x | $x, $x+1), $x', null, { vars: { x: 9 } })
      expect(result).toEqual([9, 1, 2, 9])

      // Multiple values in reduce update
      const result2 = run('$x, (reduce (1, 2) as $x (0; . + $x)), $x', null, { vars: { x: 9 } })
      expect(result2).toEqual([9, 3, 9])
    })

    it('works with nested scopes of different types', () => {
      // Global $x is 100.
      // Pipe 0 into:
      //    shadow $x with 1,
      //    reduce (10, 20) as $y using shadowed $x.
      const result = run('0 | (1 as $x | reduce (10, 20) as $y (0; . + $y + $x))', null, {
        vars: { x: 100 },
      })
      // Iteration 1: $y=10. Acc = 0 + 10 + 1 = 11.
      // Iteration 2: $y=20. Acc = 11 + 20 + 1 = 32.
      expect(result).toEqual([32])
    })
  })

  // Option B verification (Future)
  describe('Option B: $ARGS (not implemented yet)', () => {
    it.skip('populates $ARGS.named', () => {
      const result = run('$ARGS.named.foo', null, { vars: { foo: 123 } })
      expect(result).toEqual([123])
    })
  })
})
