import { gzipSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// This is a dependency-free placeholder benchmark so the repo works offline.
// For real bundle validation, run esbuild/rollup in CI and gzip the emitted file.
const input = readFileSync(resolve('bench/hello.js'), 'utf8')
writeFileSync(resolve('bench/out.js'), input)

const gz = gzipSync(input)
console.log(`${gz.length} bytes gzipped placeholder`)
