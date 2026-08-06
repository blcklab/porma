import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { compileBlck } from '../packages/porma-compiler/src/index.js'

const root = process.cwd()
const inputs = []

for (const base of ['bench', 'examples']) {
  const dir = join(root, base)
  function walk(current) {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry)
      const stat = statSync(path)
      if (stat.isDirectory()) walk(path)
      else if (path.endsWith('.blck')) inputs.push(path)
    }
  }
  walk(dir)
}

const rows = []
for (const file of inputs) {
  const source = readFileSync(file, 'utf8')
  const result = compileBlck(source, { filename: file, dev: false })
  rows.push({
    file: relative(root, file),
    raw: Buffer.byteLength(result.code),
    gzip: gzipSync(result.code).length,
    warnings: result.meta.warnings.length
  })
}

for (const row of rows) {
  console.log(`${row.file}: ${row.raw} bytes raw, ${row.gzip} bytes gzip, warnings=${row.warnings}`)
}

const totalRaw = rows.reduce((sum, row) => sum + row.raw, 0)
const totalGzip = gzipSync(rows.map((row) => row.file).join('\n') + rows.map((row) => row.raw).join('\n')).length
console.log(`compiled matrix: ${rows.length} files, ${totalRaw} bytes generated JS, ${totalGzip} bytes gzip index`)
