import { setDevMode, setDevOptions, inspectScope } from '../runtime/index.js'
import { allScopeKeys, ownScopeKeys, traceScopeValue } from '../scope/index.js'

export function enableDevtools(options = {}) {
  const resolvedOptions = {
    traceInheritance: options.traceInheritance === true,
    warnInheritedMutation: options.warnInheritedMutation !== false,
    warnShadowing: options.warnShadowing !== false,
    warnMissingProps: options.warnMissingProps !== false
  }

  setDevMode(true)
  setDevOptions(resolvedOptions)

  return {
    options: resolvedOptions,

    trace(scope, key) {
      return traceScopeValue(scope, key)
    },

    ownKeys(scope) {
      return ownScopeKeys(scope)
    },

    allKeys(scope) {
      return allScopeKeys(scope)
    },

    inspect(scope) {
      return inspectScope(scope)
    }
  }
}

export { traceScopeValue, ownScopeKeys, allScopeKeys }
