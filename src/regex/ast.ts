/**
 * Abstract syntax tree for the linear-time regex engine.
 *
 * The parser ({@link "./parse"}) produces a {@link RegexNode} tree which the
 * compiler ({@link "./compile"}) lowers into a Thompson NFA program.
 */

/** Single-character shorthand classes (`\d \D \w \W \s \S`). */
export type Shorthand = 'd' | 'D' | 'w' | 'W' | 's' | 'S'

/** POSIX bracket-class names (`[[:alpha:]]`, `[[:^digit:]]`, ...). */
export type PosixClass =
  | 'alpha'
  | 'digit'
  | 'alnum'
  | 'space'
  | 'upper'
  | 'lower'
  | 'punct'
  | 'xdigit'
  | 'blank'
  | 'cntrl'
  | 'graph'
  | 'print'
  | 'word'

/** One member of a bracketed character class `[...]`. */
export type ClassItem =
  | { kind: 'char'; cp: number }
  | { kind: 'range'; lo: number; hi: number }
  | { kind: 'shorthand'; cls: Shorthand }
  | { kind: 'posix'; cls: PosixClass; negated: boolean }

/**
 * Zero-width assertions.
 *
 * `bufStart`/`bufEnd`/`bufEndZ` are the absolute anchors `\A`/`\z`/`\Z`, which
 * pin to the whole input regardless of the `m` flag (unlike `start`/`end`).
 */
export type AnchorKind = 'start' | 'end' | 'wordB' | 'notWordB' | 'bufStart' | 'bufEnd' | 'bufEndZ'

/** A node in the regex AST. */
export type RegexNode =
  | { type: 'Empty' }
  | { type: 'Char'; cp: number }
  | { type: 'AnyChar' }
  | { type: 'Class'; negated: boolean; items: ClassItem[] }
  | { type: 'Anchor'; kind: AnchorKind }
  | { type: 'Concat'; parts: RegexNode[] }
  | { type: 'Alt'; options: RegexNode[] }
  | { type: 'Repeat'; node: RegexNode; min: number; max: number | null; greedy: boolean }
  | { type: 'Group'; node: RegexNode; capture: number | null; name: string | null }

/** Parsed, normalized flag set. The `g` (global) flag is handled by callers. */
export interface RegexFlags {
  /** `i` — case-insensitive matching. */
  ignoreCase: boolean
  /** `m` — `^` and `$` match at line boundaries. */
  multiline: boolean
  /** `s` — `.` also matches newline. */
  dotAll: boolean
  /** `x` — ignore unescaped whitespace and `#` comments in the pattern. */
  extended: boolean
}
