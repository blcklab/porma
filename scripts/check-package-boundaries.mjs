import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'))
const errors = []

function expect(condition, message) {
  if (!condition) errors.push(message)
}

const runtime = readJson('packages/porma/package.json')
const compiler = readJson('packages/porma-compiler/package.json')
const vite = readJson('packages/porma-vite/package.json')
const router = readJson('packages/porma-router/package.json')
const createPorma = readJson('packages/create-porma/package.json')

expect(!runtime.dependencies || Object.keys(runtime.dependencies).length === 0, '@blcklab/porma must have no dependencies')
expect(!compiler.dependencies || Object.keys(compiler.dependencies).length === 0, '@blcklab/porma-compiler must have no dependencies')
expect(vite.dependencies?.['@blcklab/porma-compiler'] === vite.version, '@blcklab/porma-vite must depend on matching @blcklab/porma-compiler')
expect(router.peerDependencies?.['@blcklab/porma'] === router.version, '@blcklab/porma-router must peer-depend on matching @blcklab/porma')
expect(!runtime.exports?.['./compiler'], '@blcklab/porma must not export ./compiler')
expect(!runtime.exports?.['./vite'], '@blcklab/porma must not export ./vite')
expect(!createPorma.dependencies || Object.keys(createPorma.dependencies).length === 0, 'create-porma must have no dependencies')
expect(createPorma.bin?.['create-porma'] === './bin/create-porma.mjs', 'create-porma must expose create-porma bin')

expect(runtime.publishConfig?.access === 'public', '@blcklab/porma must publish as public')
expect(compiler.publishConfig?.access === 'public', '@blcklab/porma-compiler must publish as public')
expect(vite.publishConfig?.access === 'public', '@blcklab/porma-vite must publish as public')
expect(router.publishConfig?.access === 'public', '@blcklab/porma-router must publish as public')
expect(createPorma.publishConfig?.registry === 'https://registry.npmjs.org', 'create-porma must publish to npm registry')

const runtimeIndex = readFileSync(join(root, 'packages/porma/src/index.js'), 'utf8')
expect(!runtimeIndex.includes('porma-compiler'), '@blcklab/porma runtime must not import compiler')
expect(!runtimeIndex.includes('porma-vite'), '@blcklab/porma runtime must not import Vite plugin')

if (errors.length) {
  for (const error of errors) console.error(`[Porma boundary] ${error}`)
  process.exit(1)
}

console.log('Porma package boundary check passed')
