import test from 'node:test'
import assert from 'node:assert/strict'
import { signal } from '../src/reactivity/index.js'
import { normalizeClass, setAttr } from '../src/dom/index.js'

function fakeElement() {
  const attrs = new Map()
  return {
    attrs,
    style: {},
    setAttribute(name, value) {
      attrs.set(name, String(value))
    },
    removeAttribute(name) {
      attrs.delete(name)
    }
  }
}

test('normalizeClass supports strings arrays objects and signals', () => {
  const active = signal(true)
  const value = ['card', { active, hidden: false }, ['nested']]

  assert.equal(normalizeClass(value), 'card active nested')

  active.value = false
  assert.equal(normalizeClass(value), 'card nested')
})

test('setAttr applies class and style objects without DOM dependencies', () => {
  const el = fakeElement()

  setAttr(el, 'class', { active: true, hidden: false })
  assert.equal(el.attrs.get('class'), 'active')

  setAttr(el, 'style', { color: 'red', fontWeight: 700 })
  assert.equal(el.style.color, 'red')
  assert.equal(el.style.fontWeight, '700')

  setAttr(el, 'style', { color: 'blue' })
  assert.equal(el.style.color, 'blue')
  assert.equal(el.style.fontWeight, '')
})

import { setProperty, bindEvent } from '../src/dom/index.js'

function fakeFormElement() {
  const attrs = new Map()
  return {
    attrs,
    style: {},
    value: 'old',
    checked: false,
    selected: false,
    disabled: false,
    readOnly: false,
    required: false,
    multiple: false,
    setAttribute(name, value) {
      attrs.set(name, String(value))
    },
    removeAttribute(name) {
      attrs.delete(name)
    }
  }
}

class FakeEventTarget {
  constructor() {
    this.listeners = new Map()
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener)
  }

  removeEventListener(name, listener) {
    if (this.listeners.get(name) === listener) {
      this.listeners.delete(name)
    }
  }

  dispatch(name, event = {}) {
    const listener = this.listeners.get(name)
    if (listener) listener({ target: this, preventDefault() {}, stopPropagation() {}, ...event })
  }
}

test('setProperty normalizes form string and boolean properties', () => {
  const el = fakeFormElement()

  setProperty(el, 'value', null)
  assert.equal(el.value, '')

  setProperty(el, 'checked', 1)
  setProperty(el, 'selected', 'yes')
  setProperty(el, 'disabled', true)
  setProperty(el, 'readonly', true)
  setProperty(el, 'required', true)
  setProperty(el, 'multiple', true)

  assert.equal(el.checked, true)
  assert.equal(el.selected, true)
  assert.equal(el.disabled, true)
  assert.equal(el.readOnly, true)
  assert.equal(el.required, true)
  assert.equal(el.multiple, true)
})

test('setAttr syncs dynamic boolean DOM properties and attributes', () => {
  const el = fakeFormElement()

  setAttr(el, 'disabled', true)
  assert.equal(el.disabled, true)
  assert.equal(el.attrs.has('disabled'), true)

  setAttr(el, 'disabled', false)
  assert.equal(el.disabled, false)
  assert.equal(el.attrs.has('disabled'), false)

  setAttr(el, 'readonly', true)
  assert.equal(el.readOnly, true)
  assert.equal(el.attrs.has('readonly'), true)
})

test('bindEvent returns cleanup and supports once modifier', () => {
  const target = new FakeEventTarget()
  let calls = 0

  const cleanup = bindEvent(target, 'click.once', () => {
    calls++
  })

  target.dispatch('click')
  target.dispatch('click')
  assert.equal(calls, 1)
  assert.equal(target.listeners.has('click'), false)

  cleanup()
  assert.equal(target.listeners.has('click'), false)
})
