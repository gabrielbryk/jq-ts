import { accessSpecs } from './paths/accessSpec'
import { pathsSpecs } from './paths/pathsSpec'
import type { BuiltinSpec } from './types'

// --- Builtin Exports ---

export const pathBuiltins: BuiltinSpec[] = [...pathsSpecs, ...accessSpecs]
