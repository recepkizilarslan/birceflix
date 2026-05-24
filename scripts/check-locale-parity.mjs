#!/usr/bin/env node
/**
 * Locale parity guard.
 *
 * Treats `en.json` as the canonical key set. Every other locale must have
 * exactly the same key shape, no missing keys and no extras. Catches the
 * "added a copy string in EN, forgot to add it to TR/DE" drift that
 * silently degrades the non-default locales until someone notices a key
 * showing up raw in the UI.
 *
 * Run locally:   node scripts/check-locale-parity.mjs
 * Exit code 0 on parity, 1 on drift (prints a diff).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = join(__dirname, '..', 'frontend', 'src', 'i18n', 'locales')
const CANONICAL = 'en'

function flatten(obj, prefix = '', out = {}) {
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    const next = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, next, out)
    } else {
      out[next] = v
    }
  }
  return out
}

function load(file) {
  const raw = readFileSync(join(LOCALES_DIR, file), 'utf8')
  return JSON.parse(raw)
}

const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'))
const canonicalFile = `${CANONICAL}.json`
if (!files.includes(canonicalFile)) {
  console.error(`canonical locale missing: ${canonicalFile}`)
  process.exit(2)
}

const canonicalKeys = new Set(Object.keys(flatten(load(canonicalFile))))
const others = files.filter((f) => f !== canonicalFile)

let failed = false
const PREVIEW = 10

for (const file of others) {
  const keys = new Set(Object.keys(flatten(load(file))))
  const missing = [...canonicalKeys].filter((k) => !keys.has(k))
  const extra = [...keys].filter((k) => !canonicalKeys.has(k))
  if (missing.length === 0 && extra.length === 0) {
    console.log(`  ${file}: ${keys.size} keys, parity OK`)
    continue
  }
  failed = true
  console.log(`  ${file}: ${keys.size} keys (canonical has ${canonicalKeys.size})`)
  if (missing.length > 0) {
    console.log(`    missing (${missing.length}):`)
    for (const k of missing.slice(0, PREVIEW)) console.log(`      - ${k}`)
    if (missing.length > PREVIEW) console.log(`      ... and ${missing.length - PREVIEW} more`)
  }
  if (extra.length > 0) {
    console.log(`    extra (${extra.length}):`)
    for (const k of extra.slice(0, PREVIEW)) console.log(`      - ${k}`)
    if (extra.length > PREVIEW) console.log(`      ... and ${extra.length - PREVIEW} more`)
  }
}

if (failed) {
  console.error('\nlocale parity check failed. add or remove the listed keys so every locale matches en.json.')
  process.exit(1)
}
console.log('\nall locales parity-clean.')
