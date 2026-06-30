import type { RegexFlags } from './ast'
import type { Inst, Program } from './program'
import { assertHolds, instConsumes } from './step'

interface Thread {
  pc: number
  saved: number[]
}

/** A priority-ordered set of threads with O(1) duplicate-pc suppression. */
class ThreadList {
  threads: Thread[] = []
  gen = 1
  private readonly seen: Int32Array

  constructor(size: number) {
    this.seen = new Int32Array(size)
  }

  clear(): void {
    this.threads = []
    this.gen++
  }

  /** Marks `pc` for the current generation; returns false if already present. */
  mark(pc: number): boolean {
    if (this.seen[pc] === this.gen) return false
    this.seen[pc] = this.gen
    return true
  }
}

/**
 * Pike VM: executes a Thompson NFA program over an input as parallel threads
 * with capture slots. Matching is O(input x program) with no backtracking, and
 * thread priority yields leftmost, greedy-by-default (Perl/Oniguruma) semantics.
 */
export class PikeVM {
  private readonly insts: Inst[]
  private readonly slotCount: number

  constructor(
    private readonly program: Program,
    private readonly flags: RegexFlags,
    private readonly cps: number[]
  ) {
    this.insts = program.insts
    this.slotCount = 2 * (program.groupCount + 1)
  }

  /** Adds a thread and its epsilon-closure to `list` in priority order. */
  private addThread(list: ThreadList, pc: number, pos: number, saved: number[]): void {
    const stack: Thread[] = [{ pc, saved }]
    while (stack.length > 0) {
      const top = stack.pop() as Thread
      if (!list.mark(top.pc)) continue
      const inst = this.insts[top.pc] as Inst
      if (inst.op === 'jmp') {
        stack.push({ pc: inst.x, saved: top.saved })
      } else if (inst.op === 'split') {
        stack.push({ pc: inst.y, saved: top.saved }, { pc: inst.x, saved: top.saved })
      } else if (inst.op === 'save') {
        const next = top.saved.slice()
        next[inst.slot] = pos
        stack.push({ pc: top.pc + 1, saved: next })
      } else if (inst.op === 'assert') {
        if (assertHolds(inst.kind, this.cps, pos, this.flags)) {
          stack.push({ pc: top.pc + 1, saved: top.saved })
        }
      } else {
        list.threads.push(top)
      }
    }
  }

  /**
   * Searches for the leftmost match at or after `start`.
   *
   * @returns The capture slot array, or `null` if there is no match.
   */
  search(start: number): number[] | null {
    const n = this.cps.length
    let clist = new ThreadList(this.insts.length)
    let nlist = new ThreadList(this.insts.length)
    let matched: number[] | null = null
    for (let pos = start; pos <= n; pos++) {
      if (matched === null) {
        this.addThread(clist, 0, pos, new Array<number>(this.slotCount).fill(-1))
      }
      const cp = this.cps[pos]
      for (const thread of clist.threads) {
        const inst = this.insts[thread.pc] as Inst
        if (inst.op === 'match') {
          matched = thread.saved
          break
        }
        if (instConsumes(inst, cp, this.flags)) {
          this.addThread(nlist, thread.pc + 1, pos + 1, thread.saved)
        }
      }
      const tmp = clist
      clist = nlist
      nlist = tmp
      nlist.clear()
      if (matched !== null && clist.threads.length === 0) break
    }
    return matched
  }
}
