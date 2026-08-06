export type Cleanup = () => void
export type OnCleanup = (cleanup: Cleanup) => void
export type StopHandle = () => void

export interface Signal<T> {
  value: T
  peek(): T
  update(fn: (current: T) => T): void
}

export interface ReadonlySignal<T> {
  readonly value: T
  peek(): T
}

export declare function signal<T>(initialValue: T): Signal<T>
export declare function computed<T>(getter: () => T): ReadonlySignal<T>
export declare function effect(fn: (onCleanup: OnCleanup) => void): StopHandle
export declare function batch<T>(fn: () => T): T
export declare function untrack<T>(fn: () => T): T
export declare function isSignal<T = unknown>(value: unknown): value is Signal<T> | ReadonlySignal<T>
export declare function read<T>(value: Signal<T> | ReadonlySignal<T> | T): T

export declare function setSignalMutationObserver(observer: ((signalObject: Signal<unknown> | ReadonlySignal<unknown>, nextValue: unknown, previousValue: unknown) => void) | null): void
