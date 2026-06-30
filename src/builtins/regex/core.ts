import { RuntimeError } from '../../errors'
import { type CompiledRegex, compileRegex, type RegexMatch } from '../../regex'
import type { Span } from '../../span'
import { describeType, type Value, type ValueObject } from '../../value'

/** A jq match object: offsets/lengths are codepoint indices. */
export interface JqMatch extends ValueObject {
  offset: number
  length: number
  string: string
  captures: Value[]
}

/** Splits a string into its Unicode codepoints (so offsets count codepoints). */
export const toCodepoints = (input: string): string[] => Array.from(input)

const sliceCp = (cps: string[], start: number, length: number): string =>
  cps.slice(start, start + length).join('')

/** Validates that the subject of a regex builtin is a string. */
export const requireStringInput = (input: Value, span: Span): string => {
  if (typeof input !== 'string') {
    throw new RuntimeError(
      `${describeType(input)} (${JSON.stringify(input)}) cannot be matched, as it is not a string`,
      span
    )
  }
  return input
}

/** Coerces a flags filter result (string or null) into a flag string. */
const flagsToString = (flags: Value, span: Span): string => {
  if (flags === null) return ''
  if (typeof flags === 'string') return flags
  throw new RuntimeError(`${describeType(flags)} is not a valid set of regex flags`, span)
}

/** Compiles a regex, surfacing engine errors as runtime errors. */
export const compile = (re: Value, flags: Value, span: Span): CompiledRegex => {
  if (typeof re !== 'string') {
    throw new RuntimeError(`${describeType(re)} is not a string`, span)
  }
  try {
    return compileRegex(re, flagsToString(flags, span))
  } catch (err) {
    throw new RuntimeError((err as Error).message, span)
  }
}

/** True when the flag string requests global (all-matches) iteration. */
export const isGlobal = (flags: Value): boolean => typeof flags === 'string' && flags.includes('g')

/** Returns the engine matches for the subject, honoring the global flag. */
export const findMatches = (
  compiled: CompiledRegex,
  input: string,
  global: boolean
): RegexMatch[] => {
  if (global) return compiled.matchAll(input)
  const first = compiled.exec(input)
  return first === null ? [] : [first]
}

/** Converts an engine match into jq's match-object shape. */
export const toJqMatch = (
  match: RegexMatch,
  cps: string[],
  groupNames: (string | null)[]
): JqMatch => ({
  offset: match.index,
  length: match.length,
  string: sliceCp(cps, match.index, match.length),
  captures: match.captures.map((cap, i) =>
    cap === null
      ? { offset: -1, length: 0, string: null, name: groupNames[i] ?? null }
      : {
          offset: cap.index,
          length: cap.length,
          string: sliceCp(cps, cap.index, cap.length),
          name: groupNames[i] ?? null,
        }
  ),
})

/** Builds the `{name: string|null}` capture object jq uses for `capture`/`sub`. */
export const captureObject = (
  match: RegexMatch,
  cps: string[],
  groupNames: (string | null)[]
): ValueObject => {
  const obj: ValueObject = {}
  match.captures.forEach((cap, i) => {
    const name = groupNames[i] ?? null
    if (name !== null) obj[name] = cap === null ? null : sliceCp(cps, cap.index, cap.length)
  })
  return obj
}
