import { describe, expect, it } from 'vitest'

import { compileRegex, RegexError } from '../src/regex'

/**
 * Strict-rejection battery. The engine runs untrusted expressions, so every
 * regex construct it does not implement must throw a {@link RegexError} rather
 * than silently degrading to a literal match (which would change semantics).
 */
describe('regex engine — strict rejection of unsupported constructs', () => {
  // [pattern, label] — each must throw RegexError when compiled.
  const cases: [string, string][] = [
    // Backreferences & subroutines.
    ['(a)\\1', 'numeric backreference \\1'],
    ['(?<n>a)\\k<n>', 'named backreference \\k<n>'],
    ['(a)\\g1', 'subroutine \\g1'],
    ['(a)\\g<1>', 'subroutine \\g<1>'],
    ['(?<n>a)\\g<n>', 'subroutine \\g<name>'],
    // Lookaround.
    ['a(?=b)', 'lookahead (?=)'],
    ['a(?!b)', 'negative lookahead (?!)'],
    ['(?<=a)b', 'lookbehind (?<=)'],
    ['(?<!a)b', 'negative lookbehind (?<!)'],
    // Atomic & possessive.
    ['(?>ab)', 'atomic group (?>)'],
    ['a++', 'possessive +'],
    ['a*+', 'possessive *'],
    ['a?+', 'possessive ?'],
    ['a{2,3}+', 'possessive {n,m}'],
    // Conditionals, recursion, subroutine calls.
    ['(?(1)a|b)', 'conditional (?(1)...)'],
    ['(?R)', 'recursion (?R)'],
    ['(?1)', 'subroutine call (?1)'],
    // Inline flags & branch reset.
    ['(?i)abc', 'inline flags (?i)'],
    ['(?i:abc)', 'inline flag group (?i:)'],
    ['(?-i:abc)', 'inline flag group (?-i:)'],
    ['(?|(a)|(b))', 'branch reset (?|...)'],
    // Unicode property escapes.
    ['\\p{L}', 'unicode property \\p{L}'],
    ['\\pL', 'unicode property \\pL'],
    ['\\P{N}', 'negated unicode property \\P{N}'],
    // Oniguruma special escapes.
    ['\\h', 'oniguruma \\h'],
    ['\\H', 'oniguruma \\H'],
    ['\\R', 'oniguruma \\R'],
    ['\\K', 'oniguruma \\K'],
    ['\\G', 'oniguruma \\G'],
    ['\\b{g}', 'oniguruma \\b{...} text boundary'],
    // Arbitrary unknown escapes (must not fall through to a literal).
    ['\\q', 'unknown escape \\q'],
    ['\\y', 'unknown escape \\y'],
    ['\\e', 'unknown escape \\e'],
    // Unknown / unsupported class internals.
    ['[[:bogus:]]', 'unknown POSIX class'],
    ['[\\p{L}]', 'unicode property inside class'],
    ['[\\q]', 'unknown escape inside class'],
  ]

  it.each(cases)('rejects %s (%s)', (pattern) => {
    expect(() => compileRegex(pattern)).toThrow(RegexError)
  })

  it('rejection messages name the unsupported feature', () => {
    expect(() => compileRegex('\\h')).toThrow(/unsupported regex feature/)
    expect(() => compileRegex('\\p{L}')).toThrow(/unsupported regex feature/)
    expect(() => compileRegex('(a)\\g1')).toThrow(/unsupported regex feature/)
    expect(() => compileRegex('[[:bogus:]]')).toThrow(/unsupported regex feature/)
    expect(() => compileRegex('\\b{g}')).toThrow(/unsupported regex feature/)
  })

  it('still accepts escaped metacharacters as literals', () => {
    expect(compileRegex('\\.\\*\\+\\?').exec('.*+?')).toEqual({
      index: 0,
      length: 4,
      captures: [],
    })
  })
})
