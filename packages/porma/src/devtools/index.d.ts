import type { ScopeTrace } from '../scope/index.js'

export interface DevtoolsOptions {
  traceInheritance?: boolean
  warnInheritedMutation?: boolean
  warnShadowing?: boolean
  warnMissingProps?: boolean
}

export declare function enableDevtools(options?: DevtoolsOptions): {
  options: Required<DevtoolsOptions>
  trace(scope: object, key: PropertyKey): ScopeTrace
  ownKeys(scope: object): string[]
  allKeys(scope: object): string[]
  inspect(scope: object): { owner: string; isolated: boolean; ownKeys: string[]; allKeys: string[]; shadowedKeys: string[] }
}

export { traceScopeValue, ownScopeKeys, allScopeKeys } from '../scope/index.js'
