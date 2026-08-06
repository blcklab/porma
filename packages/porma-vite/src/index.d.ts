import type { CompileBlckResult } from '@blcklab/porma-compiler'

export interface PormaViteCompileInfo {
  id: string
  code: string
  meta: CompileBlckResult['meta']
  command: 'serve' | 'build' | string
  dev: boolean
}

export interface PormaViteOptions {
  dev?: boolean
  warnings?: boolean
  sourceMap?: boolean
  include?: string | RegExp | ((id: string) => boolean) | Array<string | RegExp | ((id: string) => boolean)>
  exclude?: string | RegExp | ((id: string) => boolean) | Array<string | RegExp | ((id: string) => boolean)>
  onWarning?: (warning: string, meta: CompileBlckResult['meta']) => void
  onCompile?: (info: PormaViteCompileInfo) => void
}

export default function porma(options?: PormaViteOptions): unknown
export { compileBlck } from '@blcklab/porma-compiler'
