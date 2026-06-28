import type { FilterNode } from '../ast'
import type { CompatibilityFinding } from './types'
import { visit } from './visit'
import { semanticWarnings, specialVariableWarnings, syntaxWarningsByKind } from './warnings'

const dedupeFindings = (findings: CompatibilityFinding[]): CompatibilityFinding[] => {
  const seen = new Set<string>()
  const result: CompatibilityFinding[] = []
  for (const finding of findings) {
    const key = `${finding.category}:${finding.message}:${finding.span?.start ?? ''}:${finding.span?.end ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(finding)
  }
  return result
}

const syntaxWarningFor = (current: FilterNode): CompatibilityFinding | null => {
  const message = syntaxWarningsByKind[current.kind]
  if (!message) return null
  return {
    severity: 'warning',
    stage: 'validate',
    category: 'input-dependent',
    message,
    span: current.span,
  }
}

const callWarningFor = (current: FilterNode): CompatibilityFinding | null => {
  if (current.kind !== 'Call') return null
  const message = semanticWarnings[current.name]
  if (!message) return null
  return {
    severity: 'warning',
    stage: 'validate',
    category: 'semantic-deviation',
    message,
    span: current.span,
  }
}

const varWarningFor = (current: FilterNode): CompatibilityFinding | null => {
  if (current.kind !== 'Var') return null
  const message = specialVariableWarnings[current.name]
  if (!message) return null
  return {
    severity: 'warning',
    stage: 'validate',
    category: current.name === 'ENV' ? 'intentional-exclusion' : 'semantic-deviation',
    message,
    span: current.span,
  }
}

export const collectWarnings = (node: FilterNode): CompatibilityFinding[] => {
  const warnings: CompatibilityFinding[] = []

  visit(node, (current) => {
    for (const finding of [
      syntaxWarningFor(current),
      callWarningFor(current),
      varWarningFor(current),
    ]) {
      if (finding) warnings.push(finding)
    }
  })

  return dedupeFindings(warnings)
}
