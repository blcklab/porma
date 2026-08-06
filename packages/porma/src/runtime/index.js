import { effect, isSignal, read, setSignalMutationObserver } from '../reactivity/index.js'
import {
  createScope,
  expose,
  shared,
  isShared,
  traceScopeValue,
  shadowsInherited,
  getScopeOwner,
  getValueMeta,
  isScopeIsolated,
  listShadowedScopeKeys,
  allScopeKeys,
  ownScopeKeys
} from '../scope/index.js'

const instanceStack = []
let currentInstance = null
let currentCleanupBucket = null
const cleanupBucketStack = []
let devMode = false
let devOptions = {
  traceInheritance: false,
  warnInheritedMutation: true,
  warnShadowing: true,
  warnMissingProps: true
}
let currentMutationContext = null
const mutationContextStack = []
const tracedReads = new WeakMap()

function hasOwn(target, key) {
  return Object.prototype.hasOwnProperty.call(target, key)
}


function collectMountNodes(node) {
  if (!node) return []

  if (node.nodeType === 11) {
    return [...node.childNodes]
  }

  return [node]
}

function normalizeTarget(target) {
  if (typeof target === 'string') {
    return document.querySelector(target)
  }

  return target
}

function warn(message) {
  if (!devMode) return
  console.warn(message)
}

function info(message) {
  if (!devMode) return
  const logger = console.debug ?? console.info ?? console.log
  logger.call(console, message)
}

function shouldWarn(option) {
  return devMode && devOptions[option] !== false
}

function rememberTracedRead(scope, key) {
  let keys = tracedReads.get(scope)
  if (!keys) {
    keys = new Set()
    tracedReads.set(scope, keys)
  }

  if (keys.has(key)) return false
  keys.add(key)
  return true
}

function withInstance(instance, fn) {
  instanceStack.push(instance)
  currentInstance = instance

  try {
    return fn()
  } finally {
    instanceStack.pop()
    currentInstance = instanceStack[instanceStack.length - 1] ?? null
  }
}

export { isSignal, read, expose, shared, isShared, traceScopeValue }

setSignalMutationObserver((signalObject) => {
  if (!currentMutationContext || !shouldWarn('warnInheritedMutation')) return

  const meta = getValueMeta(signalObject)
  if (!meta || meta.shared) return

  const trace = traceScopeValue(currentMutationContext.scope, meta.key)
  if (!trace.inherited || trace.value !== signalObject) return

  warn(
    `[Porma] ${currentMutationContext.componentName} mutated inherited signal "${String(meta.key)}" from ${trace.owner}. ` +
    `Mark it with shared(signal(...)) if this mutation is intentional.`
  )
})

export function setDevMode(enabled) {
  devMode = Boolean(enabled)
}

export function setDevOptions(options = {}) {
  devOptions = {
    ...devOptions,
    ...options
  }
}

export function getDevOptions() {
  return { ...devOptions }
}

export function isDevMode() {
  return devMode
}

export function getCurrentInstance() {
  return currentInstance
}

export function withMutationContext(scope, componentName, fn) {
  mutationContextStack.push(currentMutationContext)
  currentMutationContext = {
    scope,
    componentName: componentName ?? getScopeOwner(scope)
  }

  try {
    return fn()
  } finally {
    currentMutationContext = mutationContextStack.pop() ?? null
  }
}

export function readScope(scope, key, fromComponent = null) {
  const trace = traceScopeValue(scope, key)

  if (trace.inherited && shouldWarn('traceInheritance') && rememberTracedRead(scope, key)) {
    info(`[Porma] ${fromComponent ?? getScopeOwner(scope)} inherited "${String(key)}" from ${trace.owner}.`)
  }

  return trace.value
}

export function createComponent(setup, options = {}) {
  return {
    __pormaComponent: true,
    setup,
    options: {
      name: options.name ?? setup.name ?? 'AnonymousComponent',
      inheritScope: options.inheritScope !== false
    }
  }
}

export function instantiateComponent(component, rawProps = {}, parentScope = null, parentInstance = null) {
  if (!component || component.__pormaComponent !== true) {
    throw new TypeError('Porma expected a component created with createComponent().')
  }

  const options = component.options ?? {}
  const isolated = rawProps?.isolate === true || options.inheritScope === false
  const scope = createScope(isolated ? null : parentScope, {
    owner: options.name
  })

  const instance = {
    name: options.name,
    component,
    scope,
    rawProps,
    props: null,
    parent: parentInstance,
    children: [],
    cleanups: [],
    mounted: [],
    updated: [],
    unmounted: [],
    render: null,
    node: null,
    isMounted: false,
    isUnmounted: false,
    isolated
  }

  if (parentInstance) {
    parentInstance.children.push(instance)
  }

  return withInstance(instance, () => {
    const render = component.setup(scope, rawProps, instance)

    if (typeof render !== 'function') {
      throw new TypeError(`${instance.name} setup must return a render function.`)
    }

    instance.render = render
    return instance
  })
}

export function renderComponent(instance) {
  return withInstance(instance, () => {
    const node = instance.render()
    instance.node = node
    return node
  })
}

export function mountComponent(component, target, options = {}) {
  const resolvedTarget = normalizeTarget(target)

  if (!resolvedTarget) {
    throw new Error('mount() target was not found.')
  }

  setDevMode(Boolean(options.dev))

  const rootScope = options.scope ?? {}
  const pluginCleanups = installPlugins(options.plugins ?? [], rootScope, options)
  const instance = instantiateComponent(component, options.props ?? {}, rootScope, null)
  const node = renderComponent(instance)
  const mountedNodes = collectMountNodes(node)

  resolvedTarget.textContent = ''
  resolvedTarget.appendChild(node)

  markMounted(instance)

  for (const plugin of options.plugins ?? []) {
    if (plugin && typeof plugin.start === 'function') {
      const cleanup = plugin.start(instance.scope, instance)
      if (typeof cleanup === 'function') pluginCleanups.push(cleanup)
    }
  }

  let unmounted = false

  return {
    instance,
    scope: instance.scope,
    rootScope,
    node,
    nodes: mountedNodes,
    unmount() {
      if (unmounted) return
      unmounted = true
      unmountComponent(instance)

      for (const cleanup of pluginCleanups.splice(0).reverse()) {
        cleanup()
      }

      for (const mountedNode of mountedNodes) {
        if (mountedNode.parentNode === resolvedTarget) {
          resolvedTarget.removeChild(mountedNode)
        }
      }
    }
  }
}

function installPlugins(plugins, rootScope, options) {
  const cleanups = []

  for (const plugin of plugins) {
    if (!plugin) continue

    if (typeof plugin === 'function') {
      const cleanup = plugin(rootScope, options)
      if (typeof cleanup === 'function') cleanups.push(cleanup)
      continue
    }

    if (typeof plugin.install === 'function') {
      const cleanup = plugin.install(rootScope, options)
      if (typeof cleanup === 'function') cleanups.push(cleanup)
    }
  }

  return cleanups
}

export function markMounted(instance) {
  if (!instance || instance.isMounted || instance.isUnmounted) return

  instance.isMounted = true
  runMountCallbacks(instance)
}

export function unmountComponent(instance) {
  if (!instance || instance.isUnmounted) return

  instance.isUnmounted = true

  for (const child of [...instance.children].reverse()) {
    unmountComponent(child)
  }

  runCallbacks(instance.unmounted)

  for (const cleanup of instance.cleanups.splice(0).reverse()) {
    cleanup()
  }

  if (instance.parent) {
    const index = instance.parent.children.indexOf(instance)
    if (index !== -1) instance.parent.children.splice(index, 1)
  }

  instance.children.length = 0
  instance.isMounted = false
}

export function registerCleanup(cleanup) {
  if (currentCleanupBucket) {
    currentCleanupBucket.push(cleanup)
    return cleanup
  }

  const instance = getCurrentInstance()

  if (!instance) return cleanup

  instance.cleanups.push(cleanup)
  return cleanup
}

export function createCleanupScope() {
  const cleanups = []

  return {
    run(fn) {
      cleanupBucketStack.push(cleanups)
      currentCleanupBucket = cleanups

      try {
        return fn()
      } finally {
        cleanupBucketStack.pop()
        currentCleanupBucket = cleanupBucketStack[cleanupBucketStack.length - 1] ?? null
      }
    },

    cleanup() {
      for (const cleanup of cleanups.splice(0).reverse()) {
        cleanup()
      }
    }
  }
}

export function ownedEffect(fn) {
  const instance = getCurrentInstance()
  let initialized = false

  const stop = effect((onCleanup) => {
    const result = fn(onCleanup)

    if (initialized && instance?.isMounted) {
      runCallbacks(instance.updated)
    }

    initialized = true
    return result
  })

  registerCleanup(stop)
  return stop
}

export function onMount(callback) {
  const instance = getCurrentInstance()
  if (!instance) return
  instance.mounted.push(callback)
}

export function onUpdate(callback) {
  const instance = getCurrentInstance()
  if (!instance) return
  instance.updated.push(callback)
}

export function onUnmount(callback) {
  const instance = getCurrentInstance()
  if (!instance) return
  instance.unmounted.push(callback)
}

export function defineProps(definition = {}) {
  const instance = getCurrentInstance()

  if (!instance) {
    throw new Error('defineProps() can only be called inside <logic>.')
  }

  const props = resolveProps(definition, instance.rawProps, instance.scope, instance.name)
  instance.props = props
  return props
}

export function defineOptions(options = {}) {
  const instance = getCurrentInstance()

  if (!instance) return

  Object.assign(instance.component.options, options)
}

export function defineInherits() {
  const instance = getCurrentInstance()

  if (!instance) return {}

  if (isScopeIsolated(instance.scope) && shouldWarn('traceInheritance')) {
    info(`[Porma] ${instance.name} requested inherited scope, but this component is isolated.`)
  }

  return instance.scope
}

export function resolveProps(definition = {}, explicitProps = {}, scope = null, componentName = 'Component') {
  const props = {}

  for (const key of Object.keys(definition)) {
    const rule = normalizePropRule(definition[key])

    if (hasOwn(explicitProps, key)) {
      props[key] = explicitProps[key]
      continue
    }

    if (scope && key in scope) {
      props[key] = scope[key]
      continue
    }

    if (hasOwn(rule, 'default')) {
      props[key] = typeof rule.default === 'function' ? rule.default() : rule.default
      continue
    }

    props[key] = undefined

    if (rule.required && shouldWarn('warnMissingProps')) {
      warn(`[Porma] Required prop "${key}" was not provided and no inherited value was found. Component: ${componentName}`)
    }
  }

  for (const key of Object.keys(explicitProps)) {
    if (!hasOwn(props, key)) {
      props[key] = explicitProps[key]
    }
  }

  return props
}

export function assertWritableInherited(scope, key, fromComponent = null) {
  if (!shouldWarn('warnInheritedMutation')) return

  const trace = traceScopeValue(scope, key)

  if (!trace.inherited || trace.shared) return

  warn(
    `[Porma] ${fromComponent ?? 'A descendant'} mutated inherited signal "${String(key)}" from ${trace.owner}. ` +
    `Mark it with shared(signal(...)) if this is intentional.`
  )
}

export function exposeSetup(scope, values, componentName = null) {
  if (shouldWarn('warnShadowing')) {
    for (const key of Object.keys(values)) {
      const inheritedTrace = traceScopeValue(Object.getPrototypeOf(scope), key)
      if (inheritedTrace.scope) {
        warn(`[Porma] "${key}" in ${componentName ?? getScopeOwner(scope)} shadows inherited "${key}" from ${inheritedTrace.owner}.`)
      }
    }
  }

  return expose(scope, values)
}

export function inspectScope(scope) {
  return {
    owner: getScopeOwner(scope),
    isolated: isScopeIsolated(scope),
    ownKeys: ownScopeKeys(scope),
    allKeys: allScopeKeys(scope),
    shadowedKeys: listShadowedScopeKeys(scope)
  }
}

function normalizePropRule(rule) {
  if (rule && typeof rule === 'object' && !Array.isArray(rule)) {
    return rule
  }

  return {
    default: rule
  }
}

function runMountCallbacks(instance) {
  for (const callback of [...instance.mounted]) {
    const cleanup = callback()
    if (typeof cleanup === 'function') {
      instance.cleanups.push(cleanup)
    }
  }
}

function runCallbacks(callbacks) {
  for (const callback of [...callbacks]) {
    callback()
  }
}
