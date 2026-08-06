import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const bin = join(process.cwd(), 'packages/create-porma/bin/create-porma.mjs')

function runCreate(args) {
  const cwd = mkdtempSync(join(tmpdir(), 'porma-create-'))
  execFileSync(process.execPath, [bin, ...args], {
    cwd,
    stdio: 'pipe',
    env: {
      ...process.env,
      CI: '1'
    }
  })
  return cwd
}

test('create-porma scaffolds a basic app', () => {
  const cwd = runCreate(['my-app', '--template', 'basic'])
  const app = join(cwd, 'my-app')

  assert.equal(existsSync(join(app, 'src/App.blck')), true)
  assert.equal(existsSync(join(app, 'src/main.js')), true)
  assert.equal(existsSync(join(app, 'src/components/ui/Button.blck')), true)
  assert.equal(existsSync(join(app, 'src/components/counter/CounterPanel.blck')), true)
  assert.equal(existsSync(join(app, 'src/components/todo/TodoList.blck')), true)
  assert.equal(existsSync(join(app, 'src/layouts/AppShell.blck')), true)
  assert.equal(existsSync(join(app, 'src/pages/Home.blck')), true)
  assert.equal(existsSync(join(app, 'src/styles/global.css')), true)
  assert.equal(existsSync(join(app, 'src/lib/todos.js')), true)
  assert.equal(existsSync(join(app, 'README.md')), true)

  const pkg = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'))
  assert.equal(pkg.name, 'my-app')
  assert.equal(pkg.dependencies['@blcklab/porma'], '0.1.0-rc.3')
  assert.equal(pkg.devDependencies['@blcklab/porma-vite'], '0.1.0-rc.3')
})

test('create-porma scaffolds a TypeScript app', () => {
  const cwd = runCreate(['typed-app', '--template=typescript'])
  const source = readFileSync(join(cwd, 'typed-app/src/App.blck'), 'utf8')

  assert.match(source, /<logic lang="ts">/)
  assert.match(source, /signal<number>/)
  assert.equal(existsSync(join(cwd, 'typed-app/src/types/app.d.ts')), true)
  assert.equal(existsSync(join(cwd, 'typed-app/src/components/ui/Button.blck')), true)
})

test('create-porma scaffolds a router app with router dependency', () => {
  const cwd = runCreate(['router-app', '-t', 'router'])
  const app = join(cwd, 'router-app')
  const pkg = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'))

  assert.equal(pkg.dependencies['@blcklab/porma-router'], '0.1.0-rc.3')
  assert.equal(existsSync(join(app, 'src/pages/Home.blck')), true)
  assert.equal(existsSync(join(app, 'src/app/router.js')), true)
  assert.equal(existsSync(join(app, 'src/components/navigation/AppNav.blck')), true)
})

test('create-porma rejects unknown templates', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'porma-create-'))

  assert.throws(() => {
    execFileSync(process.execPath, [bin, 'bad-app', '--template', 'unknown'], {
      cwd,
      stdio: 'pipe'
    })
  })
})
