import {
  getCurrentInstance,
  instantiateComponent,
  renderComponent,
  registerCleanup,
  unmountComponent,
  ownedEffect,
  read,
  mountComponent,
  createCleanupScope,
  markMounted,
  withMutationContext
} from '../runtime/index.js'

const injectedStyles = new Set()
const styleState = new WeakMap()
const BOOLEAN_PROPERTIES = new Set(['checked', 'selected', 'disabled', 'readOnly', 'readonly', 'required', 'multiple'])
const STRING_PROPERTIES = new Set(['value'])


export function mount(component, target, options = {}) {
  return mountComponent(component, target, options)
}

export function element(tag) {
  return document.createElement(tag)
}

export function textNode(value = '') {
  return document.createTextNode(String(value ?? ''))
}

export function comment(value = '') {
  return document.createComment(value)
}

export function removeNode(node) {
  if (node?.parentNode) {
    node.parentNode.removeChild(node)
  }
}

export function bindIf(getter, render) {
  const holder = fragment()
  const anchor = comment('porma-if')
  append(holder, anchor)

  let boundary = null
  let cleanupScope = null

  function clear() {
    if (cleanupScope) {
      cleanupScope.cleanup()
      cleanupScope = null
    }

    if (boundary) {
      boundary.remove()
      boundary = null
    }
  }

  ownedEffect(() => {
    const visible = Boolean(read(getter()))
    const parent = anchor.parentNode

    if (!parent) return

    if (!visible) {
      clear()
      return
    }

    if (boundary) return

    cleanupScope = createCleanupScope()
    const rendered = cleanupScope.run(render)
    boundary = createBoundary(rendered, 'porma-if-block')
    boundary.insertBefore(parent, anchor.nextSibling)
  })

  registerCleanup(clear)

  return holder
}

export function bindShow(node, getter) {
  const initialDisplay = node.style?.display || ''

  return ownedEffect(() => {
    node.style.display = Boolean(read(getter())) ? initialDisplay : 'none'
  })
}

export function bindList(getter, render, getKey = null) {
  const holder = fragment()
  const start = comment('porma-loop-start')
  const end = comment('porma-loop-end')
  append(holder, start)
  append(holder, end)

  let records = []

  function createRecord(item, index, key) {
    const cleanupScope = createCleanupScope()
    const rendered = cleanupScope.run(() => render(item, index))
    const boundary = createBoundary(rendered, 'porma-loop-item')

    return {
      key,
      item,
      boundary,
      cleanupScope
    }
  }

  function destroyRecord(record) {
    record.cleanupScope.cleanup()
    record.boundary.remove()
  }

  function clear() {
    for (const record of records.slice().reverse()) {
      destroyRecord(record)
    }

    records = []
  }

  function normalizeList(value) {
    const resolved = read(value)
    if (resolved == null) return []
    if (Array.isArray(resolved)) return resolved
    if (typeof resolved[Symbol.iterator] === 'function') return [...resolved]
    return []
  }

  function renderUnkeyed(parent, list) {
    clear()

    let index = 0
    for (const item of list) {
      const record = createRecord(item, index, index)
      record.boundary.insertBefore(parent, end)
      records.push(record)
      index++
    }
  }

  function renderKeyed(parent, list) {
    const oldByKey = new Map()

    for (const record of records) {
      oldByKey.set(record.key, record)
    }

    const nextRecords = []
    let index = 0

    for (const item of list) {
      const key = getKey(item, index)
      const existing = oldByKey.get(key)
      let record

      if (existing && Object.is(existing.item, item)) {
        oldByKey.delete(key)
        record = existing
      } else {
        if (existing) {
          oldByKey.delete(key)
          destroyRecord(existing)
        }

        record = createRecord(item, index, key)
      }

      record.boundary.insertBefore(parent, end)
      nextRecords.push(record)
      index++
    }

    for (const record of oldByKey.values()) {
      destroyRecord(record)
    }

    records = nextRecords
  }

  ownedEffect(() => {
    const parent = end.parentNode
    const list = normalizeList(getter())

    if (!parent) return

    if (!getKey) {
      renderUnkeyed(parent, list)
      return
    }

    renderKeyed(parent, list)
  })

  registerCleanup(clear)

  return holder
}

export function fragment(children = []) {
  const node = document.createDocumentFragment()

  for (const child of children) {
    append(node, child)
  }

  return node
}

export function append(parent, child) {
  if (child == null || child === false) return parent

  if (Array.isArray(child)) {
    for (const item of child) {
      append(parent, item)
    }

    return parent
  }

  parent.appendChild(
    child instanceof Node
      ? child
      : textNode(child)
  )

  return parent
}

export function setText(node, value) {
  node.textContent = String(read(value) ?? '')
}

export function setAttr(node, name, value) {
  const resolved = read(value)
  const propName = normalizePropertyName(name)

  if (name === 'class') {
    setClass(node, resolved)
    return
  }

  if (name === 'style') {
    setStyle(node, resolved)
    return
  }

  if (isPropertyName(propName)) {
    setProperty(node, propName, resolved)

    if (BOOLEAN_PROPERTIES.has(propName)) {
      syncBooleanAttribute(node, name, Boolean(resolved))
    }

    return
  }

  if (resolved === false || resolved == null) {
    node.removeAttribute(name)
    return
  }

  if (resolved === true) {
    node.setAttribute(name, '')
    return
  }

  node.setAttribute(name, String(resolved))
}

export function setClass(node, value) {
  const normalized = normalizeClass(value)

  if (!normalized) {
    node.removeAttribute('class')
    return
  }

  node.setAttribute('class', normalized)
}

export function normalizeClass(value) {
  const classes = []
  collectClassNames(value, classes)
  return [...new Set(classes)].join(' ')
}

function collectClassNames(value, output) {
  const resolved = read(value)

  if (resolved == null || resolved === false) return

  if (typeof resolved === 'string' || typeof resolved === 'number') {
    const text = String(resolved).trim()
    if (text) output.push(...text.split(/\s+/).filter(Boolean))
    return
  }

  if (Array.isArray(resolved)) {
    for (const item of resolved) {
      collectClassNames(item, output)
    }
    return
  }

  if (typeof resolved === 'object') {
    for (const key of Object.keys(resolved)) {
      if (Boolean(read(resolved[key]))) output.push(key)
    }
  }
}

export function setStyle(node, value) {
  const resolved = read(value)

  if (resolved == null || resolved === false) {
    node.removeAttribute('style')
    styleState.delete(node)
    return
  }

  if (typeof resolved === 'string') {
    node.setAttribute('style', resolved)
    styleState.delete(node)
    return
  }

  if (typeof resolved !== 'object') return

  const previous = styleState.get(node) ?? new Set()
  const next = new Set()

  for (const key of Object.keys(resolved)) {
    const styleValue = read(resolved[key])
    next.add(key)
    applyStyleValue(node, key, styleValue)
  }

  for (const key of previous) {
    if (!next.has(key)) {
      applyStyleValue(node, key, null)
    }
  }

  styleState.set(node, next)
}

export function setProperty(node, name, value) {
  const propName = normalizePropertyName(name)
  const resolved = read(value)

  if (STRING_PROPERTIES.has(propName)) {
    node[propName] = resolved ?? ''
    return
  }

  if (BOOLEAN_PROPERTIES.has(propName)) {
    node[propName] = Boolean(resolved)
    return
  }

  node[propName] = resolved
}

export function injectStyle(id, css) {
  if (!css || injectedStyles.has(id) || typeof document === 'undefined') return

  const style = document.createElement('style')
  style.setAttribute('data-porma-style', id)
  style.textContent = css
  document.head.appendChild(style)
  injectedStyles.add(id)
}

export function bindText(node, getter) {
  return ownedEffect(() => {
    setText(node, getter())
  })
}

export function bindAttr(node, name, getter) {
  return ownedEffect(() => {
    setAttr(node, name, getter())
  })
}

export function bindProperty(node, name, getter) {
  return ownedEffect(() => {
    setProperty(node, name, getter())
  })
}

export function bindEvent(node, name, handler) {
  const { event, modifiers } = normalizeEventBinding(name)

  if (!event) return () => {}

  const ownerInstance = getCurrentInstance()

  const listener = (eventObject) => {
    if (modifiers.has('self') && eventObject.target !== node) return
    if (modifiers.has('prevent')) eventObject.preventDefault()
    if (modifiers.has('stop')) eventObject.stopPropagation()
    if (modifiers.has('once')) cleanup()

    const invoke = () => {
      if (typeof handler === 'function') return handler(eventObject)
      if (handler && typeof handler.handleEvent === 'function') return handler.handleEvent(eventObject)
    }

    return ownerInstance
      ? withMutationContext(ownerInstance.scope, ownerInstance.name, invoke)
      : invoke()
  }

  function cleanup() {
    node.removeEventListener(event, listener)
  }

  node.addEventListener(event, listener)
  registerCleanup(cleanup)

  return cleanup
}

export function mountChild(component, props = {}, parentScope = null) {
  const parentInstance = getCurrentInstance()
  const instance = instantiateComponent(component, props, parentScope, parentInstance)
  const rendered = renderComponent(instance)
  const boundary = createBoundary(rendered, `porma-component:${instance.name}`)

  registerCleanup(() => {
    boundary.remove()
    unmountComponent(instance)
  })

  markMounted(instance)

  return boundary.fragment
}

function createBoundary(rendered, label = 'porma-boundary') {
  const start = comment(`${label}-start`)
  const end = comment(`${label}-end`)
  const boundary = fragment([start, rendered, end])

  function extract() {
    const parent = start.parentNode
    const extracted = fragment()

    if (!parent) {
      append(extracted, boundary)
      return extracted
    }

    let current = start

    while (current) {
      const next = current.nextSibling
      extracted.appendChild(current)
      if (current === end) break
      current = next
    }

    return extracted
  }

  return {
    fragment: boundary,
    start,
    end,
    insertBefore(parent, before) {
      parent.insertBefore(extract(), before)
    },
    remove() {
      const parent = start.parentNode
      if (!parent) return

      let current = start
      while (current) {
        const next = current.nextSibling
        parent.removeChild(current)
        if (current === end) break
        current = next
      }
    }
  }
}

function applyStyleValue(node, key, value) {
  const normalized = value == null || value === false ? '' : String(value)

  if (key.includes('-') && typeof node.style?.setProperty === 'function') {
    node.style.setProperty(key, normalized)
  } else if (node.style) {
    node.style[key] = normalized
  }
}

function normalizePropertyName(name) {
  return name === 'readonly' ? 'readOnly' : name
}

function isPropertyName(name) {
  return STRING_PROPERTIES.has(name) || BOOLEAN_PROPERTIES.has(name)
}

function syncBooleanAttribute(node, name, enabled) {
  if (enabled) {
    node.setAttribute(name, '')
  } else {
    node.removeAttribute(name)
  }
}

function normalizeEventBinding(name) {
  const normalized = normalizeEventName(name)
  const [event, ...modifiers] = normalized.split('.')

  return {
    event,
    modifiers: new Set(modifiers)
  }
}

function normalizeEventName(name) {
  if (name.startsWith('on.')) return name.slice(3).toLowerCase()

  return name.startsWith('on') && name.length > 2
    ? name.slice(2).toLowerCase()
    : name.toLowerCase()
}
