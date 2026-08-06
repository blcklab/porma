import test from 'node:test'
import assert from 'node:assert/strict'
import { signal } from '../src/reactivity/index.js'
import { createScope, expose, shared, traceScopeValue, allScopeKeys, ownScopeKeys } from '../src/scope/index.js'

test('scope inherits through Object.create prototype chain', () => {
  const parent = createScope(null, { owner: 'Parent' })
  expose(parent, { count: signal(0), theme: signal('dark') })

  const child = createScope(parent, { owner: 'Child' })
  const grandchild = createScope(child, { owner: 'Grandchild' })

  assert.equal(grandchild.count.value, 0)
  assert.equal(grandchild.theme.value, 'dark')

  parent.count.value = 2

  assert.equal(child.count.value, 2)
  assert.equal(grandchild.count.value, 2)
})

test('local scope declarations shadow inherited values', () => {
  const parent = createScope(null, { owner: 'Parent' })
  expose(parent, { theme: signal('dark') })

  const child = createScope(parent, { owner: 'Child' })
  expose(child, { theme: signal('light') })

  assert.equal(parent.theme.value, 'dark')
  assert.equal(child.theme.value, 'light')
})

test('traceScopeValue explains where an inherited value came from', () => {
  const parent = createScope(null, { owner: 'App' })
  expose(parent, { count: shared(signal(0)) })

  const child = createScope(parent, { owner: 'CounterText' })

  const trace = traceScopeValue(child, 'count')

  assert.equal(trace.key, 'count')
  assert.equal(trace.owner, 'App')
  assert.equal(trace.inherited, true)
  assert.equal(trace.shared, true)
})

test('ownScopeKeys returns local keys and allScopeKeys includes inherited keys', () => {
  const parent = createScope(null, { owner: 'App' })
  expose(parent, { count: signal(0) })

  const child = createScope(parent, { owner: 'Child' })
  expose(child, { label: 'Save' })

  assert.deepEqual(ownScopeKeys(child), ['label'])
  assert.deepEqual(allScopeKeys(child).sort(), ['count', 'label'])
})
