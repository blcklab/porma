export type Scope = Record<PropertyKey, unknown>

export interface ScopeOptions {
  owner?: string
}

export interface ScopeTrace<T = unknown> {
  key: PropertyKey
  value: T | undefined
  owner: string | null
  inherited: boolean
  depth: number
  shared: boolean
  scope: object | null
}

export declare function createScope<TScope extends object = Scope>(parentScope?: object | null, options?: ScopeOptions): TScope
export declare function isolateScope<TScope extends object = Scope>(initialValues?: Partial<TScope>, options?: ScopeOptions): TScope
export declare function expose<TValues extends object>(scope: object, values: TValues, options?: { shared?: boolean }): object & TValues
export declare function defineScopeValue<T>(scope: object, key: PropertyKey, value: T, options?: { shared?: boolean }): T
export declare function shared<T extends object>(value: T): T
export declare function isShared(value: unknown): boolean
export declare function getScopeOwner(scope: object): string
export declare function getScopeMeta(scope: object): { owner: string; isolated: boolean; parent: object | null; createdAt: number } | null
export declare function ownScopeKeys(scope: object): string[]
export declare function allScopeKeys(scope: object): string[]
export declare function traceScopeValue<T = unknown>(scope: object, key: PropertyKey): ScopeTrace<T>
export declare function shadowsInherited(scope: object, key: PropertyKey): boolean
export declare function isScopeIsolated(scope: object): boolean
export declare function listShadowedScopeKeys(scope: object): string[]
export declare function getValueMeta(value: unknown): { key: PropertyKey; owner: string; ownerScope: object; shared: boolean } | null
