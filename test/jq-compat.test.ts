import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { run, type Value } from '../src'

const jqBin = process.env.JQ_BIN ?? 'jq'

const jqVersionResult = spawnSync(jqBin, ['--version'], { encoding: 'utf8' })
const jqAvailable = jqVersionResult.status === 0
const jqVersion = jqAvailable ? parseJqVersion(jqVersionResult.stdout.trim()) : null
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

type Fixture = {
  name: string
  expr: string
  input: Value
  expectError?: boolean
  minJqVersion?: string
}
const fixturePath = resolve(__dirname, './fixtures/jq-compat.json')
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const fixtures: Fixture[] = JSON.parse(readFileSync(fixturePath, 'utf8'))

describeIfJq('jq compatibility (integration)', () => {
  test.each(fixtures.map((f) => [f.name, f.expr, f.input, f.expectError === true, f.minJqVersion]))(
    '%s',
    (_name, expr, input, shouldError, minJqVersion) => {
      if (minJqVersion && jqVersion && compareVersions(jqVersion, parseVersion(minJqVersion)) < 0) {
        return
      }
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
        // Assert error
        expect(jqResult.ok).toBe(false)
        expect(ourResult.ok).toBe(false)
      } else {
        // Assert success
        expect(jqResult.ok).toBe(true)
        expect(ourResult.ok).toBe(true)
        if (jqResult.ok && ourResult.ok) {
          expect(ourResult.value).toEqual(jqResult.value)
        }
      }
    }
  )
})

function parseJqVersion(output: string): number[] {
  return parseVersion(output.replace(/^jq-/, ''))
}

function parseVersion(version: string): number[] {
  return version.split('.').map((part) => Number.parseInt(part, 10) || 0)
}

function compareVersions(left: number[], right: number[]): -1 | 0 | 1 {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index] ?? 0
    const rightPart = right[index] ?? 0
    if (leftPart < rightPart) return -1
    if (leftPart > rightPart) return 1
  }
  return 0
}
