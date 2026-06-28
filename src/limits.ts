import { RuntimeError } from './errors'
import type { Span } from './span'

/**
 * Configuration options for execution limits.
 * All fields are optional and default to safe values if strictly undefined.
 */
export interface LimitsConfig {
  /** Maximum number of AST nodes to visit during execution. Default: 100,000. */
  maxSteps?: number
  /** Maximum recursion depth for execution and parsing. Default: 200. */
  maxDepth?: number
  /** Maximum number of values to yield from a single output emitter. Default: 10,000. */
  maxOutputs?: number
}

/**
 * Fully resolved limits with defaults applied.
 */
export interface ResolvedLimits {
  maxSteps: number
  maxDepth: number
  maxOutputs: number
}

const DEFAULT_LIMITS: ResolvedLimits = {
  maxSteps: 100_000,
  maxDepth: 200,
  maxOutputs: 10_000,
}

/**
 * Resolves a partial limits configuration into a complete one with defaults.
 *
 * @param config - The user-provided configuration.
 * @returns The resolved limits.
 */
export const resolveLimits = (config: LimitsConfig = {}): ResolvedLimits => ({
  maxSteps: config.maxSteps ?? DEFAULT_LIMITS.maxSteps,
  maxDepth: config.maxDepth ?? DEFAULT_LIMITS.maxDepth,
  maxOutputs: config.maxOutputs ?? DEFAULT_LIMITS.maxOutputs,
})

/**
 * Tracks execution usage against defined limits.
 * Throws {@link RuntimeError} if any limit is exceeded.
 */
export class LimitTracker {
  private steps = 0
  private depth = 0
  private outputs = 0

  /**
   * @param limits - Resolved execution limits.
   * @param nowSeconds - The wall-clock instant exposed to the `now` builtin, as
   *   seconds since the Unix epoch (may be fractional). When `undefined`, the
   *   `now` builtin throws rather than reading the host clock — jq-ts never
   *   reads the real clock on its own, so date programs stay deterministic
   *   unless the caller injects a clock via `options.now`.
   */
  constructor(
    private readonly limits: ResolvedLimits,
    private readonly nowSeconds?: number
  ) {}

  /**
   * Returns the injected wall-clock instant (seconds since the Unix epoch) for
   * the `now` builtin.
   * @param span - The source span for error reporting.
   * @throws {RuntimeError} If no clock was injected (`options.now` was unset).
   */
  now(span: Span): number {
    if (this.nowSeconds === undefined) {
      throw new RuntimeError(
        'now/0 requires an injected clock; pass options.now (a Date or epoch seconds)',
        span
      )
    }
    return this.nowSeconds
  }

  /**
   * Records a single execution step (AST node visit).
   * @param span - The source span for error reporting.
   */
  step(span: Span): void {
    this.steps += 1
    if (this.steps > this.limits.maxSteps) {
      throw new RuntimeError('Step limit exceeded', span)
    }
  }

  /**
   * Enters a new scope/stack frame, incrementing the depth counter.
   * @param span - The source span for error reporting.
   */
  enter(span: Span): void {
    this.depth += 1
    if (this.depth > this.limits.maxDepth) {
      throw new RuntimeError('Max depth exceeded', span)
    }
  }

  /**
   * Exits the current scope, decrementing the depth counter.
   */
  exit(): void {
    this.depth = Math.max(0, this.depth - 1)
  }

  /**
   * Records an output value being emitted.
   * @param span - The source span for error reporting.
   */
  emit(span: Span): void {
    this.outputs += 1
    if (this.outputs > this.limits.maxOutputs) {
      throw new RuntimeError('Output limit exceeded', span)
    }
  }
}
