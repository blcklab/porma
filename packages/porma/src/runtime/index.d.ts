import type { Signal, ReadonlySignal } from '../reactivity/index.js'
import type { ScopeTrace } from '../scope/index.js'
export { isSignal, read } from '../reactivity/index.js'
export { expose, shared, isShared, traceScopeValue } from '../scope/index.js'

export type MaybeSignal<T> = T | Signal<T> | ReadonlySignal<T>
export type Cleanup = () => void
export type ComponentRender = () => Node
export type ComponentSetup<TScope extends object = object, TRawProps extends object = object> = (scope: TScope, rawProps: TRawProps, instance: ComponentInstance<TScope, TRawProps>) => ComponentRender

export interface ComponentOptions {
  name?: string
  inheritScope?: boolean
}

export interface Component<TScope extends object = object, TRawProps extends object = object> {
  __pormaComponent: true
  setup: ComponentSetup<TScope, TRawProps>
  options: Required<ComponentOptions>
}

export interface ComponentInstance<TScope extends object = object, TRawProps extends object = object> {
  name: string
  component: Component<TScope, TRawProps>
  scope: TScope
  rawProps: TRawProps
  props: object | null
  parent: ComponentInstance | null
  children: ComponentInstance[]
  cleanups: Cleanup[]
  mounted: Array<() => void | Cleanup>
  updated: Array<() => void>
  unmounted: Array<() => void>
  render: ComponentRender | null
  node: Node | null
  isMounted: boolean
  isUnmounted: boolean
  isolated: boolean
}

export type PropRule<T = unknown> = {
  default?: T | (() => T)
  required?: boolean
}

export type PropDefinition<TProps extends object = Record<string, unknown>> = {
  [K in keyof TProps]?: PropRule<TProps[K]> | TProps[K]
}


export type PormaPlugin =
  | ((scope: object, options?: MountOptions) => void | Cleanup)
  | {
      install?: (scope: object, options?: MountOptions) => void | Cleanup
      start?: (scope: object, instance: ComponentInstance) => void | Cleanup
    }

export interface MountOptions {
  props?: object
  scope?: object | null
  dev?: boolean
  plugins?: PormaPlugin[]
}

export interface DevRuntimeOptions {
  traceInheritance?: boolean
  warnInheritedMutation?: boolean
  warnShadowing?: boolean
  warnMissingProps?: boolean
}

export declare function setDevMode(enabled: boolean): void
export declare function setDevOptions(options?: DevRuntimeOptions): void
export declare function getDevOptions(): Required<DevRuntimeOptions>
export declare function isDevMode(): boolean
export declare function getCurrentInstance(): ComponentInstance | null
export declare function withMutationContext<T>(scope: object, componentName: string | null | undefined, fn: () => T): T
export declare function readScope<T = unknown>(scope: object, key: PropertyKey, fromComponent?: string | null): T | undefined
export declare function createComponent<TScope extends object = object, TRawProps extends object = object>(setup: ComponentSetup<TScope, TRawProps>, options?: ComponentOptions): Component<TScope, TRawProps>
export declare function instantiateComponent<TScope extends object = object, TRawProps extends object = object>(component: Component<TScope, TRawProps>, rawProps?: TRawProps, parentScope?: object | null, parentInstance?: ComponentInstance | null): ComponentInstance<TScope, TRawProps>
export declare function renderComponent(instance: ComponentInstance): Node
export declare function mountComponent(component: Component, target: string | Element, options?: MountOptions): { instance: ComponentInstance; scope: object; rootScope: object; node: Node; nodes: Node[]; unmount(): void }
export declare function markMounted(instance: ComponentInstance): void
export declare function unmountComponent(instance: ComponentInstance): void
export declare function registerCleanup(cleanup: Cleanup): Cleanup
export declare function createCleanupScope(): { run<T>(fn: () => T): T; cleanup(): void }
export declare function ownedEffect(fn: Parameters<typeof import('../reactivity/index.js').effect>[0]): Cleanup
export declare function onMount(callback: () => void | Cleanup): void
export declare function onUpdate(callback: () => void): void
export declare function onUnmount(callback: () => void): void
export declare function defineProps<TProps extends object = Record<string, unknown>>(definition?: PropDefinition<TProps>): TProps
export declare function defineOptions(options?: ComponentOptions): void
export declare function defineInherits<TScope extends object = Record<string, unknown>>(): TScope
export declare function resolveProps<TProps extends object = Record<string, unknown>>(definition?: PropDefinition<TProps>, explicitProps?: Partial<TProps>, scope?: object | null, componentName?: string): TProps
export declare function assertWritableInherited(scope: object, key: PropertyKey, fromComponent?: string | null): void
export declare function exposeSetup<TValues extends object>(scope: object, values: TValues, componentName?: string | null): object & TValues
export declare function inspectScope(scope: object): { owner: string; isolated: boolean; ownKeys: string[]; allKeys: string[]; shadowedKeys: string[] }
