import test from 'node:test'
import assert from 'node:assert/strict'
import { signal } from '../src/reactivity/index.js'
import { createComponent, onMount, onUnmount } from '../src/runtime/index.js'
import { mount, element, textNode, append, bindText, bindProperty, injectStyle } from '../src/dom/index.js'

let WindowCtor = null
try {
  const mod = await import('happy-dom')
  WindowCtor = mod.Window
} catch {
  WindowCtor = null
}

function installDom() {
  const window = new WindowCtor()
  globalThis.window = window
  globalThis.document = window.document
  globalThis.Node = window.Node
  globalThis.Element = window.Element
  return window
}

function uninstallDom() {
  delete globalThis.window
  delete globalThis.document
  delete globalThis.Node
  delete globalThis.Element
}

test('DOM renderer updates text nodes through signals', { skip: !WindowCtor }, () => {
  installDom()

  try {
    const count = signal(0)
    const App = createComponent(() => {
      return () => {
        const span = element('span')
        append(span, textNode('Count: '))
        const value = textNode()
        bindText(value, () => count.value)
        append(span, value)
        return span
      }
    }, { name: 'DomCounter' })

    const target = document.createElement('div')
    const mounted = mount(App, target)

    assert.equal(target.textContent, 'Count: 0')
    count.value = 2
    assert.equal(target.textContent, 'Count: 2')

    mounted.unmount()
    count.value = 3
    assert.equal(target.textContent, '')
  } finally {
    uninstallDom()
  }
})

test('DOM renderer writes form values as properties', { skip: !WindowCtor }, () => {
  installDom()

  try {
    const name = signal('Avelino')
    const input = element('input')

    bindProperty(input, 'value', () => name.value)
    assert.equal(input.value, 'Avelino')

    name.value = 'Porma'
    assert.equal(input.value, 'Porma')
  } finally {
    uninstallDom()
  }
})

test('DOM renderer injects scoped styles once', { skip: !WindowCtor }, () => {
  installDom()

  try {
    injectStyle('porma-test', '[data-porma-test] { color: red; }')
    injectStyle('porma-test', '[data-porma-test] { color: blue; }')

    assert.equal(document.head.querySelectorAll('style[data-porma-style="porma-test"]').length, 1)
    assert.equal(document.head.textContent.includes('color: red'), true)
  } finally {
    uninstallDom()
  }
})

test('component mount and unmount lifecycle run in DOM', { skip: !WindowCtor }, () => {
  installDom()

  try {
    const calls = []
    const App = createComponent(() => {
      onMount(() => calls.push('mount'))
      onUnmount(() => calls.push('unmount'))

      return () => element('main')
    }, { name: 'LifecycleApp' })

    const target = document.createElement('div')
    const mounted = mount(App, target)
    mounted.unmount()

    assert.deepEqual(calls, ['mount', 'unmount'])
  } finally {
    uninstallDom()
  }
})
