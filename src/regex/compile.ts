import type { RegexNode } from './ast'
import type { ParseResult } from './parse'
import type { Inst, Program } from './program'

type SplitInst = Extract<Inst, { op: 'split' }>
type JmpInst = Extract<Inst, { op: 'jmp' }>

class Compiler {
  private readonly insts: Inst[] = []

  build(node: RegexNode, groupCount: number, names: (string | null)[]): Program {
    this.insts.push({ op: 'save', slot: 0 })
    this.emit(node)
    this.insts.push({ op: 'save', slot: 1 }, { op: 'match' })
    return { insts: this.insts, groupCount, names }
  }

  private emit(node: RegexNode): void {
    switch (node.type) {
      case 'Empty':
        return
      case 'Char':
        this.insts.push({ op: 'char', cp: node.cp })
        return
      case 'AnyChar':
        this.insts.push({ op: 'any' })
        return
      case 'Class':
        this.insts.push({ op: 'class', items: node.items, negated: node.negated })
        return
      case 'Anchor':
        this.insts.push({ op: 'assert', kind: node.kind })
        return
      case 'Concat':
        for (const part of node.parts) this.emit(part)
        return
      case 'Group':
        this.emitGroup(node)
        return
      case 'Alt':
        this.emitAlt(node.options)
        return
      case 'Repeat':
        this.emitRepeat(node.node, node.min, node.max, node.greedy)
        return
    }
  }

  private emitGroup(node: Extract<RegexNode, { type: 'Group' }>): void {
    if (node.capture === null) {
      this.emit(node.node)
      return
    }
    this.insts.push({ op: 'save', slot: 2 * node.capture })
    this.emit(node.node)
    this.insts.push({ op: 'save', slot: 2 * node.capture + 1 })
  }

  private emitAlt(options: RegexNode[]): void {
    const jmps: JmpInst[] = []
    for (let i = 0; i < options.length; i++) {
      if (i === options.length - 1) {
        this.emit(options[i] as RegexNode)
        break
      }
      const split: SplitInst = { op: 'split', x: 0, y: 0 }
      this.insts.push(split)
      split.x = this.insts.length
      this.emit(options[i] as RegexNode)
      const jmp: JmpInst = { op: 'jmp', x: 0 }
      this.insts.push(jmp)
      jmps.push(jmp)
      split.y = this.insts.length
    }
    const end = this.insts.length
    for (const jmp of jmps) jmp.x = end
  }

  private emitRepeat(node: RegexNode, min: number, max: number | null, greedy: boolean): void {
    for (let i = 0; i < min; i++) this.emit(node)
    if (max === null) {
      this.emitStar(node, greedy)
    } else {
      this.emitBounded(node, max - min, greedy)
    }
  }

  private emitStar(node: RegexNode, greedy: boolean): void {
    const splitIndex = this.insts.length
    const split: SplitInst = { op: 'split', x: 0, y: 0 }
    this.insts.push(split)
    const bodyStart = this.insts.length
    this.emit(node)
    this.insts.push({ op: 'jmp', x: splitIndex })
    const after = this.insts.length
    this.aim(split, bodyStart, after, greedy)
  }

  private emitBounded(node: RegexNode, count: number, greedy: boolean): void {
    const pending: { split: SplitInst; bodyStart: number }[] = []
    for (let i = 0; i < count; i++) {
      const split: SplitInst = { op: 'split', x: 0, y: 0 }
      this.insts.push(split)
      const bodyStart = this.insts.length
      this.emit(node)
      pending.push({ split, bodyStart })
    }
    const end = this.insts.length
    for (const { split, bodyStart } of pending) this.aim(split, bodyStart, end, greedy)
  }

  private aim(split: SplitInst, body: number, exit: number, greedy: boolean): void {
    split.x = greedy ? body : exit
    split.y = greedy ? exit : body
  }
}

/**
 * Compiles a parsed regex into a Thompson NFA {@link Program} for the Pike VM.
 *
 * @param parsed - The parser output (AST plus capture metadata).
 */
export const compileProgram = (parsed: ParseResult): Program =>
  new Compiler().build(parsed.node, parsed.groupCount, parsed.names)
