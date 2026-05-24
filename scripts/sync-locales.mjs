import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const LOCALES_DIR = join(process.cwd(), 'frontend', 'src', 'i18n', 'locales')
const trRaw = readFileSync(join(LOCALES_DIR, 'tr.json'), 'utf8')
const trObj = JSON.parse(trRaw)

const files = readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json'))

for (const file of files) {
  if (file === 'tr.json') continue;
  const raw = readFileSync(join(LOCALES_DIR, file), 'utf8')
  const obj = JSON.parse(raw)
  
  if (!obj.nav) obj.nav = {}
  obj.nav.import = trObj.nav.import
  obj.nav.quiz = trObj.nav.quiz
  
  obj.quiz = trObj.quiz
  
  writeFileSync(join(LOCALES_DIR, file), JSON.stringify(obj, null, 2) + '\n')
}
console.log("Synced exactly")
