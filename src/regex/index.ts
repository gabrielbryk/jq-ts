import type { RegexFlags } from './ast'
import { compileProgram } from './compile'
import { parseFlags } from './flags'
import { parsePattern } from './parse'
import type { Program } from './program'
import { PikeVM } from './vm'

export type { RegexFlags } from './ast'
export { RegexError } from './errors'

/** One captured group within a {@link RegexMatch}. Indices are codepoints. */
export interface CaptureMatch {
  index: number
  length: number
  name: string | null
}

/** A successful match. `index`/`length` and capture indices are in codepoints. */
export interface RegexMatch {
  index: number
  length: number
  captures: (CaptureMatch | null)[]
}

/** A compiled, reusable matcher produced by {@link compileRegex}. */
export interface CompiledRegex {
  /** Leftmost match at or after `startCodepointIndex` (default 0), or null. */
  exec(input: string, startCodepointIndex?: number): RegexMatch | null
  /** All non-overlapping matches, advancing past empty matches by one codepoint. */
  matchAll(input: string): RegexMatch[]
  /**
   * Names of the capturing groups, indexed by capture position (group `i+1`);
   * `null` for unnamed groups. Length equals the number of capturing groups.
   * Exposed so callers can label non-participating captures (which {@link
   * RegexMatch} reports as `null`) with their declared group name.
   */
  readonly groupNames: (string | null)[]
}

const toCodepoints = (input: string): number[] =>
  Array.from(input, (ch) => ch.codePointAt(0) as number)

const buildMatch = (saved: number[], program: Program): RegexMatch => {
  const index = saved[0] as number
  const captures: (CaptureMatch | null)[] = []
  for (let g = 1; g <= program.groupCount; g++) {
    const start = saved[2 * g] as number
    const end = saved[2 * g + 1] as number
    captures.push(
      start < 0 || end < 0
        ? null
        : { index: start, length: end - start, name: program.names[g] ?? null }
    )
  }
  return { index, length: (saved[1] as number) - index, captures }
}

const execCodepoints = (
  program: Program,
  flags: RegexFlags,
  cps: number[],
  start: number
): RegexMatch | null => {
  const saved = new PikeVM(program, flags, cps).search(start)
  return saved === null ? null : buildMatch(saved, program)
}

const collectAll = (program: Program, flags: RegexFlags, cps: number[]): RegexMatch[] => {
  const matches: RegexMatch[] = []
  let pos = 0
  while (pos <= cps.length) {
    const match = execCodepoints(program, flags, cps, pos)
    if (match === null) break
    matches.push(match)
    pos = match.length === 0 ? match.index + 1 : match.index + match.length
  }
  return matches
}

/**
 * Compiles a pattern + flag string into a linear-time matcher.
 *
 * @param pattern - The regex pattern.
 * @param flags - A jq/Oniguruma-style flag string (`i`, `m`, `s`, `x`, `g`).
 * @returns A reusable {@link CompiledRegex}.
 * @throws {RegexError} On invalid flags, syntax errors, or unsupported features
 *   (backreferences, lookaround, atomic groups, possessive quantifiers).
 */
export const compileRegex = (pattern: string, flags = ''): CompiledRegex => {
  const parsedFlags = parseFlags(flags)
  const program = compileProgram(parsePattern(pattern, parsedFlags.extended))
  const groupNames: (string | null)[] = []
  for (let g = 1; g <= program.groupCount; g++) groupNames.push(program.names[g] ?? null)
  return {
    groupNames,
    exec(input, startCodepointIndex = 0): RegexMatch | null {
      const cps = toCodepoints(input)
      const start = Math.max(0, Math.min(startCodepointIndex, cps.length))
      return execCodepoints(program, parsedFlags, cps, start)
    },
    matchAll(input): RegexMatch[] {
      return collectAll(program, parsedFlags, toCodepoints(input))
    },
  }
}
