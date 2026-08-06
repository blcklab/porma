import type { Component, Signal } from '@blcklab/porma'

export interface RouteRecord {
  path: string
  name?: string | null
  component?: Component | null
  meta?: Record<string, unknown>
}

export interface RouteLocation {
  path: string
  fullPath: string
  query: Record<string, string | string[]>
  hash: string
  params: Record<string, string>
  matched: RouteRecord | null
  component: Component | null
  name: string | null
  meta: Record<string, unknown>
}

export type RouterGuard = (to: RouteLocation, from: RouteLocation) => false | void
export type RouterHook = (to: RouteLocation, from: RouteLocation) => void

export interface Router {
  routes: RouteRecord[]
  mode: 'history' | 'hash'
  currentRoute: Signal<RouteLocation>
  route: Signal<RouteLocation>
  resolve(to: string): RouteLocation
  push(to: string): RouteLocation | false
  replace(to: string): RouteLocation | false
  addRoute(route: RouteRecord): () => boolean
  removeRoute(nameOrPath: string): boolean
  beforeEach(guard: RouterGuard): () => void
  afterEach(hook: RouterHook): () => void
  createHref(to: string | { path: string }): string
  isActive(to: string | { path: string }, options?: { exact?: boolean }): boolean
  install(scope: object): void
  start(): () => void
}

export declare function createRouter(options?: { routes?: RouteRecord[]; mode?: 'history' | 'hash'; initialPath?: string }): Router
export declare function useRouter(scope?: { router?: Router } | null): Router | null
export declare function useRoute(scope?: { route?: Signal<RouteLocation> } | null): Signal<RouteLocation> | null
export declare const RouterLink: Component
export declare const RouterView: Component
export declare function createRouteScope(router: Router): { router: Router; route: Signal<RouteLocation> }
export declare function installRouter(router: Router): { install(scope: object): void; start(): () => void }
export declare function onRouterMount(router: Router): void
