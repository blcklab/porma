import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const packages = ['porma', 'porma-compiler', 'porma-vite', 'porma-router', 'create-porma']

for (const name of packages) {
  const pkg = JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'), 'utf8'))
  const deps = Object.keys(pkg.dependencies ?? {})
  const peers = Object.keys(pkg.peerDependencies ?? {})
  console.log(`${pkg.name}@${pkg.version} deps=${deps.length ? deps.join(',') : 'none'} peers=${peers.length ? peers.join(',') : 'none'}`)
}
