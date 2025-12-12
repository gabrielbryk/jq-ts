import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { run, type Value } from '../src'

const jqBin = process.env.JQ_BIN ?? 'jq'

const jqAvailable = spawnSync(jqBin, ['--version'], { encoding: 'utf8' }).status === 0
const describeIfJq = jqAvailable ? describe : describe.skip

const runJq = (expr: string, input: Value): Value[] => {
  const result = spawnSync(jqBin, ['-c', expr], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, JQ_COLORS: '0' },
  })
  if (result.status !== 0) {
    const message = result.stderr || result.stdout || result.error?.message || 'jq failed'
    throw new Error(String(message).trim())
  }
  const output = result.stdout.trim()
  if (output === '') return []
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return output.split('\n').map((line) => JSON.parse(line))
}

type Fixture = { name: string; expr: string; input: Value; expectError?: boolean }
const fixturePath = resolve(__dirname, './fixtures/jq-compat.json')
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const fixtures: Fixture[] = JSON.parse(readFileSync(fixturePath, 'utf8'))

describeIfJq('jq compatibility (integration)', () => {
  test.each(fixtures.map((f) => [f.name, f.expr, f.input, f.expectError === true]))(
    '%s',
    (_name, expr, input, shouldError) => {
      const jqResult = (() => {
        try {
          return { ok: true as const, value: runJq(expr, input) }
        } catch (err) {
          return { ok: false as const, error: err }
        }
      })()

      const ourResult = (() => {
        try {
          return { ok: true as const, value: run(expr, input) }
        } catch (err) {
          return { ok: false as const, error: err }
        }
      })()

      if (shouldError) {
        expect(jqResult.ok).toBe(false)
        expect(ourResult.ok).toBe(false)
      } else {
        expect(jqResult.ok).toBe(true)
        expect(ourResult.ok).toBe(true)
        if (jqResult.ok && ourResult.ok) {
          expect(ourResult.value).toEqual(jqResult.value)
        }
      }
    }
  )
})
