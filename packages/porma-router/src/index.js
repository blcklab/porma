import {
  signal,
  computed,
  shared,
  createComponent,
  defineProps,
  onMount,
  onUnmount,
  effect,
  read,
  createCleanupScope
} from '@blcklab/porma'
import { mountChild } from '@blcklab/porma/dom'

function trimSlashes(value) {
  return String(value ?? '').replace(/^\/+|\/+$/g, '')
}

function normalizePath(path) {
  const value = String(path || '/')
  return value.startsWith('/') ? value : `/${value}`
}

function splitPathAndQuery(path) {
  const url = String(path || '/')
  const hashIndex = url.indexOf('#')
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex + 1)
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex)
  const queryIndex = withoutHash.indexOf('?')
  const pathname = normalizePath(queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex))
  const search = queryIndex === -1 ? '' : withoutHash.slice(queryIndex + 1)

  return {
    path: pathname,
    query: parseQuery(search),
    hash
  }
}

function parseQuery(search) {
  const query = {}
  const params = new URLSearchParams(search || '')

  for (const [key, value] of params.entries()) {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      query[key] = Array.isArray(query[key]) ? [...query[key], value] : [query[key], value]
    } else {
      query[key] = value
    }
  }

  return query
}

function compileRoute(path) {
  const keys = []
  const clean = normalizePath(path)
  const pattern = trimSlashes(clean)
    .split('/')
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith(':')) {
        keys.push(part.slice(1))
        return '([^/]+)'
      }

      if (part === '*') {
        keys.push('wildcard')
        return '(.*)'
      }

      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')

  const regex = new RegExp(`^/${pattern}${pattern ? '' : '?'}$`)

  return { regex, keys }
}

function resolveRoute(routes, to) {
  const location = splitPathAndQuery(to)

  for (const route of routes) {
    const matcher = route.__matcher ?? (route.__matcher = compileRoute(route.path))
    const match = location.path.match(matcher.regex)

    if (!match) continue

    const params = {}
    matcher.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(match[index + 1] ?? '')
    })

    return {
      path: location.path,
      fullPath: buildFullPath(location),
      query: location.query,
      hash: location.hash,
      params,
      matched: route,
      component: route.component ?? null,
      name: route.name ?? null,
      meta: route.meta ?? {}
    }
  }

  return {
    path: location.path,
    fullPath: buildFullPath(location),
    query: location.query,
    hash: location.hash,
    params: {},
    matched: null,
    component: null,
    name: null,
    meta: {}
  }
}

function buildFullPath(location) {
  const search = new URLSearchParams(location.query).toString()
  return `${location.path}${search ? `?${search}` : ''}${location.hash ? `#${location.hash}` : ''}`
}

function getBrowserPath(mode) {
  if (typeof window === 'undefined') return '/'
  if (mode === 'hash') return window.location.hash.slice(1) || '/'
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function createRouter(options = {}) {
  const routes = [...(options.routes ?? [])]
  const mode = options.mode === 'hash' ? 'hash' : 'history'
  const beforeHooks = []
  const afterHooks = []
  const currentRoute = signal(resolveRoute(routes, options.initialPath ?? getBrowserPath(mode)))

  function resolve(to) {
    return resolveRoute(routes, to)
  }

  function commit(to, replace = false) {
    const next = resolve(to)
    const from = currentRoute.value

    for (const guard of beforeHooks) {
      if (guard(next, from) === false) return false
    }

    currentRoute.value = next

    if (typeof window !== 'undefined') {
      const url = mode === 'hash' ? `#${next.fullPath}` : next.fullPath
      const method = replace ? 'replaceState' : 'pushState'
      window.history?.[method]?.({}, '', url)
    }

    for (const hook of afterHooks) {
      hook(next, from)
    }

    return next
  }

  function push(to) {
    return commit(to, false)
  }

  function replace(to) {
    return commit(to, true)
  }

  function addRoute(route) {
    routes.push(route)
    return () => removeRoute(route.name ?? route.path)
  }

  function removeRoute(nameOrPath) {
    const index = routes.findIndex((route) => route.name === nameOrPath || route.path === nameOrPath)
    if (index === -1) return false
    routes.splice(index, 1)
    currentRoute.value = resolve(currentRoute.value.fullPath ?? currentRoute.value.path)
    return true
  }

  function beforeEach(guard) {
    beforeHooks.push(guard)
    return () => {
      const index = beforeHooks.indexOf(guard)
      if (index !== -1) beforeHooks.splice(index, 1)
    }
  }

  function afterEach(hook) {
    afterHooks.push(hook)
    return () => {
      const index = afterHooks.indexOf(hook)
      if (index !== -1) afterHooks.splice(index, 1)
    }
  }

  function createHref(to) {
    const route = typeof to === 'string' ? resolve(to) : resolve(to?.path ?? '/')
    return mode === 'hash' ? `#${route.fullPath}` : route.fullPath
  }

  function isActive(to, options = {}) {
    const exact = options.exact !== false
    const target = typeof to === 'string' ? resolve(to) : resolve(to?.path ?? '/')
    const current = currentRoute.value
    return exact
      ? current.path === target.path
      : current.path === target.path || current.path.startsWith(`${target.path.replace(/\/$/, '')}/`)
  }

  function install(scope) {
    scope.router = router
    scope.route = shared(currentRoute)
  }

  function start() {
    if (typeof window === 'undefined') return () => {}

    const update = () => {
      currentRoute.value = resolve(getBrowserPath(mode))
    }

    window.addEventListener('popstate', update)
    if (mode === 'hash') window.addEventListener('hashchange', update)

    return () => {
      window.removeEventListener('popstate', update)
      if (mode === 'hash') window.removeEventListener('hashchange', update)
    }
  }

  const router = {
    routes,
    mode,
    currentRoute,
    route: currentRoute,
    resolve,
    push,
    replace,
    addRoute,
    removeRoute,
    beforeEach,
    afterEach,
    createHref,
    isActive,
    install,
    start
  }

  return router
}

export function useRouter(scope = null) {
  if (scope?.router) return scope.router
  return null
}

export function useRoute(scope = null) {
  if (scope?.route) return scope.route
  return null
}

export const RouterLink = /*#__PURE__*/ createComponent((scope) => {
  const props = defineProps({
    to: { required: true },
    replace: { default: false },
    activeClass: { default: 'active' },
    exact: { default: true },
    label: { default: '' }
  })

  return () => {
    const a = document.createElement('a')
    const to = String(read(props.to) ?? '/')
    a.setAttribute('href', scope.router?.createHref?.(to) ?? to)
    a.textContent = String(read(props.label) ?? to)

    const stopActive = effect(() => {
      const activeClass = read(props.activeClass)
      const router = scope.router

      if (!activeClass || !router?.isActive) {
        a.removeAttribute('class')
        return
      }

      if (router.isActive(to, { exact: read(props.exact) !== false })) {
        a.setAttribute('class', activeClass)
      } else {
        a.removeAttribute('class')
      }
    })

    onUnmount(stopActive)

    a.addEventListener('click', (event) => {
      event.preventDefault()
      const router = scope.router
      if (!router) return
      read(props.replace) ? router.replace(to) : router.push(to)
    })

    return a
  }
}, { name: 'RouterLink' })

export const RouterView = /*#__PURE__*/ createComponent((scope) => {
  let stop = null

  onUnmount(() => {
    stop?.()
    stop = null
  })

  return () => {
    const outlet = document.createComment('porma-router-view')
    let currentNode = null

    function clear() {
      if (currentNode?.parentNode) {
        currentNode.parentNode.removeChild(currentNode)
      }
      currentNode = null
    }

    stop = effect((onCleanup) => {
      const parent = outlet.parentNode
      if (!parent) return

      clear()
      const route = read(scope.route)
      const component = route?.component

      if (!component || component.__pormaComponent !== true) return

      const cleanupScope = createCleanupScope()
      currentNode = cleanupScope.run(() => mountChild(component, { route }, scope))
      parent.insertBefore(currentNode, outlet.nextSibling)

      onCleanup(() => {
        cleanupScope.cleanup()
        clear()
      })
    })

    return outlet
  }
}, { name: 'RouterView' })

export function createRouteScope(router) {
  return {
    router,
    route: shared(router.currentRoute)
  }
}

export function installRouter(router) {
  return {
    install(scope) {
      router.install(scope)
    },
    start() {
      return router.start()
    }
  }
}

export function onRouterMount(router) {
  let stop = null
  onMount(() => {
    stop = router.start()
  })
  onUnmount(() => {
    stop?.()
    stop = null
  })
}
