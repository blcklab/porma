const SHARED = Symbol.for('porma.shared')
const scopeMeta = new WeakMap()
const valueMeta = new WeakMap()

function hasOwn(target, key) {
  return Object.prototype.hasOwnProperty.call(target, key)
}

export function createScope(parentScope = null, options = {}) {
  const scope = Object.create(parentScope ?? null)

  scopeMeta.set(scope, {
    owner: options.owner ?? 'anonymous',
    isolated: parentScope === null,
    parent: parentScope,
    createdAt: Date.now()
  })

  return scope
}

export function isolateScope(initialValues = {}, options = {}) {
  const scope = createScope(null, {
    owner: options.owner,
    isolated: true
  })

  Object.assign(scope, initialValues)

  return scope
}

export function expose(scope, values, options = {}) {
  for (const key of Object.keys(values)) {
    defineScopeValue(scope, key, values[key], options)
  }

  return scope
}

export function defineScopeValue(scope, key, value, options = {}) {
  if (!scope || typeof scope !== 'object') {
    throw new TypeError('defineScopeValue() expects a scope object.')
  }

  scope[key] = value

  if (value && typeof value === 'object') {
    valueMeta.set(value, {
      key,
      owner: getScopeOwner(scope),
      ownerScope: scope,
      shared: Boolean(value[SHARED] || options.shared)
    })
  }

  return value
}

export function shared(value) {
  if (value && typeof value === 'object') {
    Object.defineProperty(value, SHARED, {
      value: true,
      enumerable: false,
      configurable: false
    })
  }

  return value
}

export function isShared(value) {
  return Boolean(value && typeof value === 'object' && value[SHARED])
}

export function getScopeOwner(scope) {
  return scopeMeta.get(scope)?.owner ?? 'anonymous'
}

export function getScopeMeta(scope) {
  return scopeMeta.get(scope) ?? null
}

export function ownScopeKeys(scope) {
  return Object.keys(scope)
}

export function allScopeKeys(scope) {
  const keys = new Set()
  let current = scope

  while (current) {
    for (const key of Object.keys(current)) {
      keys.add(key)
    }

    current = Object.getPrototypeOf(current)
  }

  return [...keys]
}

export function traceScopeValue(scope, key) {
  let current = scope
  let depth = 0

  while (current) {
    if (hasOwn(current, key)) {
      const value = current[key]

      return {
        key,
        value,
        owner: getScopeOwner(current),
        inherited: depth > 0,
        depth,
        shared: isShared(value),
        scope: current
      }
    }

    current = Object.getPrototypeOf(current)
    depth++
  }

  return {
    key,
    value: undefined,
    owner: null,
    inherited: false,
    depth: -1,
    shared: false,
    scope: null
  }
}

export function shadowsInherited(scope, key) {
  if (!hasOwn(scope, key)) return false

  let current = Object.getPrototypeOf(scope)

  while (current) {
    if (hasOwn(current, key)) return true
    current = Object.getPrototypeOf(current)
  }

  return false
}

export function isScopeIsolated(scope) {
  return Boolean(scopeMeta.get(scope)?.isolated)
}

export function listShadowedScopeKeys(scope) {
  return ownScopeKeys(scope).filter((key) => shadowsInherited(scope, key))
}

export function getValueMeta(value) {
  return value && typeof value === 'object' ? valueMeta.get(value) ?? null : null
}
