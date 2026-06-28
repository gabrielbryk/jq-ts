import { RuntimeError } from './errors'
import type { Span } from './span'

/**
 * Supplies the wall-clock instant used by the `now` builtin.
 *
 * The instant is always caller-injected; jq-ts never reads the host clock on
 * its own, so date programs stay deterministic unless a clock is provided via
 * `options.now`. When no instant was injected, {@link Clock.now} throws.
 */
export class Clock {
  /**
   * @param nowSeconds - The injected instant as seconds since the Unix epoch
   *   (may be fractional), or `undefined` when no clock was provided.
   */
  constructor(private readonly nowSeconds?: number) {}

  /**
   * Returns the injected instant (seconds since the Unix epoch) for `now`.
   *
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
}

/**
 * Builds a {@link Clock} from the `now` option, normalizing a `Date` or epoch
 * seconds to seconds since the Unix epoch. A `undefined` option yields a clock
 * whose `now` throws.
 */
export const resolveClock = (now?: Date | number): Clock =>
  new Clock(now === undefined ? undefined : now instanceof Date ? now.getTime() / 1000 : now)
