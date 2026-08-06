export interface CompileBlckResult {
  code: string
  map: null
  meta: {
    name: string
    blocks: string[]
    bindings: string[]
    imports: string[]
    domImports: string[]
    runtimeImports: string[]
    inheritScope: boolean
    logicLang: string
    scopeId: string | null
    scopedStyle: boolean
    parserMode: 'porma-scanner'
    warnings: string[]
  }
}

export declare function compileBlck(source: string, options?: { filename?: string; dev?: boolean }): CompileBlckResult
export interface BlckDiagnostic {
  level: 'warning' | 'error'
  message: string
  position?: { line: number; column: number }
}

export declare function parseBlocks(source: string): Record<string, string> & { readonly __attrs?: Record<string, Record<string, string | boolean>>; readonly __diagnostics?: BlckDiagnostic[] }
export declare function stripTypeScriptLogic(source: string): string
