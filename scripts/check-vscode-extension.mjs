import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const extensionDir = join(root, 'tools', 'porma-blck-vscode')
const requiredFiles = [
  'package.json',
  'language-configuration.json',
  'syntaxes/blck.tmLanguage.json',
  'snippets/blck.json',
  'fixtures/App.blck',
  'README.md',
  'CHANGELOG.md',
  'LICENSE'
]

for (const file of requiredFiles) {
  const path = join(extensionDir, file)
  if (!existsSync(path)) {
    throw new Error(`Missing VS Code extension file: ${file}`)
  }
}

function readJson(file) {
  return JSON.parse(readFileSync(join(extensionDir, file), 'utf8'))
}

const pkg = readJson('package.json')
if (pkg.name !== 'porma-blck') throw new Error('VS Code extension package name must be porma-blck')
if (!pkg.contributes?.languages?.some((lang) => lang.extensions?.includes('.blck'))) {
  throw new Error('VS Code extension must register .blck files')
}
if (!pkg.contributes?.grammars?.some((grammar) => grammar.scopeName === 'source.blck')) {
  throw new Error('VS Code extension must contribute source.blck grammar')
}
if (!pkg.contributes?.snippets?.some((snippet) => snippet.language === 'porma-blck')) {
  throw new Error('VS Code extension must contribute porma-blck snippets')
}

const grammar = readJson('syntaxes/blck.tmLanguage.json')
const grammarText = JSON.stringify(grammar)
for (const token of ['<logic', '<view', '<style', 'on', 'loop', 'if', 'show']) {
  if (!grammarText.includes(token)) {
    throw new Error(`VS Code grammar missing expected token: ${token}`)
  }
}

const snippets = readJson('snippets/blck.json')
for (const name of ['Porma Component', 'Porma TypeScript Component', 'Porma Loop', 'Porma Inherits']) {
  if (!snippets[name]) throw new Error(`Missing snippet: ${name}`)
}

console.log('Porma BLCK VS Code extension check passed.')
