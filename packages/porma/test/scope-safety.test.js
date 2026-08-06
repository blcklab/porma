import test from 'node:test'
import assert from 'node:assert/strict'
import { signal } from '../src/reactivity/index.js'
import { createScope, expose, shared } from '../src/scope/index.js'
import {
  setDevMode,
  setDevOptions,
  withMutationContext,
  readScope,
  exposeSetup,
  inspectScope,
  defineInherits,
  createComponent,
  instantiateComponent
} from '../src/runtime/index.js'

function captureConsole(method, fn) {
  const original = console[method]
  const messages = []
  console[method] = (message) => messages.push(String(message))

  try {
    fn(messages)
  } finally {
    console[method] = original
  }

  return messages
}

function resetDev() {
  setDevMode(false)
  setDevOptions({
    traceInheritance: false,
    warnInheritedMutation: true,
    warnShadowing: true,
    warnMissingProps: true
  })
}

test('dev mode warns when a descendant mutates an unshared inherited signal', () => {
  resetDev()
  setDevMode(true)
  setDevOptions({ warnInheritedMutation: true })

  const parent = createScope(null, { owner: 'App' })
  expose(parent, { count: signal(0) })
  const child = createScope(parent, { owner: 'CounterButton' })

  const warnings = captureConsole('warn', () => {
    withMutationContext(child, 'CounterButton', () => {
      child.count.value++
    })
  })

  assert.equal(child.count.value, 1)
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /mutated inherited signal "count" from App/)

  resetDev()
})

test('shared inherited signals can be mutated without dev warning', () => {
  resetDev()
  setDevMode(true)
  setDevOptions({ warnInheritedMutation: true })

  const parent = createScope(null, { owner: 'App' })
  expose(parent, { count: shared(signal(0)) })
  const child = createScope(parent, { owner: 'CounterButton' })

  const warnings = captureConsole('warn', () => {
    withMutationContext(child, 'CounterButton', () => {
      child.count.value++
    })
  })

  assert.equal(child.count.value, 1)
  assert.deepEqual(warnings, [])

  resetDev()
})

test('readScope traces inherited reads once when enabled', () => {
  resetDev()
  setDevMode(true)
  setDevOptions({ traceInheritance: true })

  const parent = createScope(null, { owner: 'App' })
  expose(parent, { theme: signal('dark') })
  const child = createScope(parent, { owner: 'ThemeText' })

  const messages = captureConsole('debug', () => {
    assert.equal(readScope(child, 'theme', 'ThemeText'), parent.theme)
    assert.equal(readScope(child, 'theme', 'ThemeText'), parent.theme)
  })

  assert.equal(messages.length, 1)
  assert.match(messages[0], /ThemeText inherited "theme" from App/)

  resetDev()
})

test('exposeSetup warns when a local binding shadows inherited scope', () => {
  resetDev()
  setDevMode(true)
  setDevOptions({ warnShadowing: true })

  const parent = createScope(null, { owner: 'App' })
  expose(parent, { theme: signal('dark') })
  const child = createScope(parent, { owner: 'Panel' })

  const warnings = captureConsole('warn', () => {
    exposeSetup(child, { theme: signal('light') }, 'Panel')
  })

  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /"theme" in Panel shadows inherited "theme" from App/)

  resetDev()
})

test('inspectScope reports isolation, keys, and shadowed keys', () => {
  const parent = createScope(null, { owner: 'App' })
  expose(parent, { theme: signal('dark') })
  const child = createScope(parent, { owner: 'Panel' })
  expose(child, { theme: signal('light'), label: 'Card' })

  assert.deepEqual(inspectScope(child), {
    owner: 'Panel',
    isolated: false,
    ownKeys: ['theme', 'label'],
    allKeys: ['theme', 'label'],
    shadowedKeys: ['theme']
  })
})

test('defineInherits returns an isolated scope when the component opts out of inheritance', () => {
  resetDev()

  const parent = createScope(null, { owner: 'App' })
  expose(parent, { theme: signal('dark') })

  let inherited
  const Isolated = createComponent((scope) => {
    inherited = defineInherits()
    return () => ({ nodeType: 11, childNodes: [] })
  }, { name: 'Isolated', inheritScope: false })

  const instance = instantiateComponent(Isolated, {}, parent, null)

  assert.equal(instance.isolated, true)
  assert.equal(inherited, instance.scope)
  assert.equal('theme' in inherited, false)
})
