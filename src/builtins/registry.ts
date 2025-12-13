import type { BuiltinSpec } from './types'

export const builtins: Record<string, BuiltinSpec[]> = {}

export const registerBuiltin = (spec: BuiltinSpec) => {
  if (!builtins[spec.name]) {
    builtins[spec.name] = []
  }
  builtins[spec.name]!.push(spec)
}

export const registerBuiltins = (specs: BuiltinSpec[]) => {
  for (const spec of specs) {
    registerBuiltin(spec)
  }
}
