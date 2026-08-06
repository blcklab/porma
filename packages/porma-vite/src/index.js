import { compileBlck } from '@blcklab/porma-compiler'

const BLCK_RE = /\.blck(?:\?.*)?$/

function cleanId(id) {
  return String(id).split('?')[0]
}

function toList(value) {
  return Array.isArray(value) ? value : [value]
}

function matches(pattern, id) {
  if (pattern == null) return false

  for (const item of toList(pattern)) {
    if (item == null) continue
    if (typeof item === 'function' && item(id)) return true
    if (item instanceof RegExp && item.test(id)) return true
    if (typeof item === 'string' && id.includes(item)) return true
  }

  return false
}

function shouldTransform(id, options) {
  const file = cleanId(id)
  if (!BLCK_RE.test(file)) return false
  if (matches(options.exclude, file)) return false
  if (options.include == null) return true
  return matches(options.include, file)
}

function normalizeWarning(warning) {
  return typeof warning === 'string' ? warning : String(warning?.message ?? warning)
}

export default function porma(options = {}) {
  let isDev = options.dev === true
  let command = 'build'

  const plugin = {
    name: 'porma-blck',
    enforce: 'pre',

    config() {
      return {
        optimizeDeps: {
          exclude: ['@blcklab/porma-compiler']
        }
      }
    },

    configResolved(config) {
      command = config.command
      if (typeof options.dev !== 'boolean') {
        isDev = command === 'serve'
      }
    },

    transform(code, id) {
      if (!shouldTransform(id, options)) return null

      const filename = cleanId(id)
      const result = compileBlck(code, {
        filename,
        dev: isDev
      })

      const warnings = result.meta.warnings.map(normalizeWarning)

      if (options.onWarning) {
        for (const warning of warnings) options.onWarning(warning, result.meta)
      }

      if (isDev || options.warnings !== false) {
        for (const warning of warnings) this.warn(warning)
      }

      options.onCompile?.({
        id: filename,
        code: result.code,
        meta: result.meta,
        command,
        dev: isDev
      })

      return {
        code: result.code,
        map: options.sourceMap === false ? null : result.map,
        meta: {
          porma: result.meta
        }
      }
    },

    handleHotUpdate(ctx) {
      if (!shouldTransform(ctx.file, options)) return undefined
      return ctx.modules?.length ? ctx.modules : undefined
    }
  }

  return plugin
}

export { compileBlck } from '@blcklab/porma-compiler'
