import type { Component, MountOptions } from '../runtime/index.js'

export declare function mount(component: Component, target: string | Element, options?: MountOptions): { instance: import('../runtime/index.js').ComponentInstance; scope: object; rootScope: object; node: Node; unmount(): void }
export declare function element<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K]
export declare function element(tag: string): HTMLElement
export declare function textNode(value?: unknown): Text
export declare function comment(value?: string): Comment
export declare function removeNode(node: Node | null | undefined): void
export declare function bindIf(getter: () => unknown, render: () => Node): DocumentFragment
export declare function bindShow(node: HTMLElement, getter: () => unknown): () => void
export declare function bindList<T>(getter: () => T[] | import('../reactivity/index.js').Signal<T[]>, render: (item: T, index: number) => Node, getKey?: ((item: T, index: number) => unknown) | null): DocumentFragment
export declare function fragment(children?: unknown[]): DocumentFragment
export declare function append<T extends Node>(parent: T, child: unknown): T
export declare function setText(node: Node, value: unknown): void
export declare function setAttr(node: Element, name: string, value: unknown): void
export declare function setClass(node: Element, value: unknown): void
export declare function normalizeClass(value: unknown): string
export declare function setStyle(node: HTMLElement, value: unknown): void
export declare function setProperty<T extends object, K extends keyof T>(node: T, name: K, value: T[K] | unknown): void
export declare function injectStyle(id: string, css: string): void
export declare function bindText(node: Node, getter: () => unknown): () => void
export declare function bindAttr(node: Element, name: string, getter: () => unknown): () => void
export declare function bindProperty<T extends object, K extends keyof T>(node: T, name: K, getter: () => T[K]): () => void
export declare function bindEvent(node: EventTarget, name: string, handler: EventListenerOrEventListenerObject | ((event: Event) => unknown) | null | undefined): () => void
export declare function mountChild(component: Component, props?: object, parentScope?: object | null): DocumentFragment
