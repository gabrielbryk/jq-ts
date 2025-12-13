/**
 * Internal error class used to implement control flow breaks (`break $label`).
 * Caught by `evalLabel` or `evalForeach`/`evalReduce` if labels match.
 */
export class BreakSignal extends Error {
  constructor(public readonly label: string) {
    super(`Break: ${label}`)
    // Set prototype explicitly for instance checks if compiling to ES5 (common TS issue)
    Object.setPrototypeOf(this, BreakSignal.prototype)
  }
}
