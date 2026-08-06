import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const scopeDir = join(root, 'node_modules', '@blcklab')
const packages = ['porma', 'porma-compiler', 'porma-vite', 'porma-router']
const created = []

function walkTests(dir, out = []) {
  if (!existsSync(dir)) return out

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      walkTests(path, out)
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      out.push(path)
    }
  }

  return out
}

function cleanup() {
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
}

mkdirSync(scopeDir, { recursive: true })

for (const name of packages) {
  const link = join(scopeDir, name)
  if (existsSync(link)) continue

  symlinkSync(resolve(root, 'packages', name), link, 'dir')
  created.push(link)
}

const testDirs = [
  'packages/porma/test',
  'packages/porma-compiler/test',
  'packages/porma-router/test',
  'packages/porma-vite/test',
  'packages/create-porma/test'
]

const testFiles = testDirs
  .flatMap((dir) => walkTests(join(root, dir)))
  .sort()

if (testFiles.length === 0) {
  console.error('No test files found.')
  cleanup()
  process.exit(1)
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit'
})

cleanup()
process.exit(result.status ?? 1)
