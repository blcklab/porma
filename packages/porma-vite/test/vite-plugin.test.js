import test from 'node:test'
import assert from 'node:assert/strict'
import porma from '../src/index.js'

test('Porma Vite plugin transforms .blck files and reports compile metadata', () => {
  const compiled = []
  const warnings = []
  const plugin = porma({
    dev: true,
    onCompile(info) {
      compiled.push(info)
    },
    onWarning(warning) {
      warnings.push(warning)
    }
  })

  const result = plugin.transform.call({ warn() {} }, '<view><p>{count}</p></view>', '/src/App.blck')

  assert.equal(typeof result.code, 'string')
  assert.match(result.code, /createComponent/)
  assert.equal(result.meta.porma.name, 'App')
  assert.equal(compiled.length, 1)
  assert.ok(warnings.some((warning) => warning.includes('count')))
})

test('Porma Vite plugin respects include and exclude filters', () => {
  const plugin = porma({ include: /components/, exclude: /Ignored/ })

  assert.equal(plugin.transform.call({ warn() {} }, '<view></view>', '/src/App.blck'), null)
  assert.equal(plugin.transform.call({ warn() {} }, '<view></view>', '/src/components/Ignored.blck'), null)

  const result = plugin.transform.call({ warn() {} }, '<view><p>Hello</p></view>', '/src/components/Card.blck')
  assert.equal(typeof result.code, 'string')
})

test('Porma Vite plugin marks .blck modules for HMR updates', () => {
  const plugin = porma()
  const module = { id: '/src/App.blck' }
  const result = plugin.handleHotUpdate({ file: '/src/App.blck', modules: [module] })

  assert.deepEqual(result, [module])
  assert.equal(plugin.handleHotUpdate({ file: '/src/App.js', modules: [] }), undefined)
})
