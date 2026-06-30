import type { AnchorKind, ClassItem } from './ast'

/**
 * A single instruction in the compiled Thompson NFA program executed by the
 * Pike VM ({@link "./vm"}).
 *
 * Consuming instructions (`char`, `any`, `class`) advance the input by one
 * codepoint. Control instructions (`jmp`, `split`, `save`, `assert`, `match`)
 * are zero-width and resolved during epsilon-closure.
 */
export type Inst =
  | { op: 'char'; cp: number }
  | { op: 'any' }
  | { op: 'class'; items: ClassItem[]; negated: boolean }
  | { op: 'assert'; kind: AnchorKind }
  | { op: 'jmp'; x: number }
  | { op: 'split'; x: number; y: number }
  | { op: 'save'; slot: number }
  | { op: 'match' }

/**
 * A compiled program: the instruction array plus capture-group metadata.
 */
export interface Program {
  /** The instruction sequence. */
  insts: Inst[]
  /** Number of capturing groups (group 0 is the whole match, not counted). */
  groupCount: number
  /** Names of capturing groups, indexed 1..groupCount; `null` when unnamed. */
  names: (string | null)[]
}
