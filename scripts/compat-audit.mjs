// Regenerates the jq 1.8 manual compatibility tally in planning-docs/compatibility.md.
//
// It fetches the structured jq manual (manual.yml) for a pinned jq version,
// extracts every example program, and classifies each one statically with
// jq-ts's analyzeCompatibility (parse + validate + semantic-warning pass).
//
// Usage:
//   pnpm run compat-audit          # print the tally
//   pnpm run compat-audit --write  # also rewrite the marked regions in the doc
//
// Requires a network connection (fetches the manual) and a prior build
// (imports the compiled analyzer from dist/).

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { load as parseYaml } from 'js-yaml'
import { analyzeCompatibility } from '../dist/index.mjs'

const JQ_VERSION = 'jq-1.8.1'
const MANUAL_URL = `https://raw.githubusercontent.com/jqlang/jq/${JQ_VERSION}/docs/content/manual/v1.8/manual.yml`

const here = dirname(fileURLToPath(import.meta.url))
const DOC_PATH = join(here, '..', 'planning-docs', 'compatibility.md')

const fail = (msg) => {
  console.error(`compat-audit: ${msg}`)
  process.exit(1)
}

// Collect every example `program` string from the manual document tree.
const collectPrograms = (node, out) => {
  if (Array.isArray(node)) {
    for (const item of node) collectPrograms(item, out)
  } else if (node && typeof node === 'object') {
    if (typeof node.program === 'string') out.push(node.program)
    for (const value of Object.values(node)) collectPrograms(value, out)
  }
  return out
}

const main = async () => {
  let text
  try {
    const res = await fetch(MANUAL_URL)
    if (!res.ok) fail(`fetch ${MANUAL_URL} -> HTTP ${res.status}`)
    text = await res.text()
  } catch (err) {
    fail(`could not fetch the jq manual (network required): ${err.message}`)
  }

  const programs = collectPrograms(parseYaml(text), [])
  if (programs.length === 0) fail('no example programs found in the manual')

  let accepted = 0
  let unsupported = 0
  let acceptedWithWarnings = 0
  const byCategory = {}

  for (const program of programs) {
    const result = analyzeCompatibility(program)
    if (result.compatible) {
      accepted += 1
      if (result.warnings.length > 0) acceptedWithWarnings += 1
    } else {
      unsupported += 1
      for (const f of result.findings) {
        if (f.severity === 'error') byCategory[f.category] = (byCategory[f.category] ?? 0) + 1
      }
    }
  }

  const total = programs.length
  console.log(`jq manual: ${JQ_VERSION}`)
  console.log(`example programs:           ${total}`)
  console.log(`statically accepted:        ${accepted}`)
  console.log(`statically unsupported:     ${unsupported}`)
  console.log(`accepted with warnings:     ${acceptedWithWarnings}`)
  console.log('unsupported by category:')
  for (const [cat, n] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${n}`)
  }

  if (!process.argv.includes('--write')) return

  const summary = `The jq ${JQ_VERSION.replace('jq-', '')} manual defines ${total} example programs. Run each through \`analyzeCompatibility\` (a static parse + validate + semantic-warning pass), ${accepted} parse and validate in jq-ts, ${unsupported} are statically unsupported, and ${acceptedWithWarnings} accepted examples carry known semantic warnings. These counts are a static audit aid, not a conformance guarantee, because some jq behavior is input-dependent. Regenerate them with \`pnpm run compat-audit --write\`.`

  const table = [
    '| Result                          | Count | Meaning                                                    |',
    '| ------------------------------- | ----: | ---------------------------------------------------------- |',
    `| Manual example programs          | ${String(total).padStart(5)} | Example programs in the jq ${JQ_VERSION.replace('jq-', '')} manual (\`manual.yml\`).        |`,
    `| Statically accepted by jq-ts     | ${String(accepted).padStart(5)} | Expression parsed and validated by jq-ts.                  |`,
    `| Statically unsupported by jq-ts  | ${String(unsupported).padStart(5)} | Failed lexing, parsing, validation, or builtin arity.      |`,
    `| Accepted with semantic warnings  | ${String(acceptedWithWarnings).padStart(5)} | Accepted but uses a feature with known jq-vs-jq-ts diffs.  |`,
  ].join('\n')

  let doc = readFileSync(DOC_PATH, 'utf8')
  const regions = [
    ['<!-- AUDIT:SUMMARY:START -->', '<!-- AUDIT:SUMMARY:END -->', summary],
    ['<!-- AUDIT:TABLE:START -->', '<!-- AUDIT:TABLE:END -->', table],
  ]
  for (const [start, end, body] of regions) {
    const re = new RegExp(`${start}[\\s\\S]*?${end}`)
    if (!re.test(doc)) fail(`marker ${start} not found in ${DOC_PATH}`)
    doc = doc.replace(re, `${start}\n${body}\n${end}`)
  }
  writeFileSync(DOC_PATH, doc)
  console.log(`\nwrote audit regions to ${DOC_PATH}`)
}

await main()
