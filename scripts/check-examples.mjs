import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { compileBlck } from '../packages/porma-compiler/src/index.js'

const root = join(process.cwd(), 'examples')
const files = []

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path)
    else if (path.endsWith('.blck')) files.push(path)
  }
}

walk(root)

let failures = 0
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const result = compileBlck(source, { filename: file, dev: false })
  if (!result.code.includes('createComponent')) {
    console.error(`[Porma example] ${file} did not compile to a component`)
    failures++
  }
}

if (failures) process.exit(1)
console.log(`Porma examples compile check passed (${files.length} .blck files)`)
