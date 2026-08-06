import { mkdirSync, existsSync, symlinkSync, rmSync, lstatSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const scopeDir = join(root, 'node_modules', '@blcklab')
const packages = ['porma', 'porma-compiler', 'porma-vite', 'porma-router']
const created = []

mkdirSync(scopeDir, { recursive: true })

for (const name of packages) {
  const link = join(scopeDir, name)
  if (existsSync(link)) continue

  symlinkSync(resolve(root, 'packages', name), link, 'dir')
  created.push(link)
}

const args = [
  '--test',
  'packages/porma/test/*.test.js',
  'packages/porma-compiler/test/*.test.js',
  'packages/porma-router/test/*.test.js',
  'packages/porma-vite/test/*.test.js',
  'packages/create-porma/test/*.test.js'
]

const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32'
})

for (const link of created.reverse()) {
  try {
    if (lstatSync(link).isSymbolicLink()) rmSync(link)
  } catch {}
}

try {
  if (existsSync(scopeDir) && readdirSync(scopeDir).length === 0) rmSync(scopeDir)
  const nodeModules = join(root, 'node_modules')
  if (existsSync(nodeModules) && readdirSync(nodeModules).length === 0) rmSync(nodeModules)
} catch {}

process.exit(result.status ?? 1)
