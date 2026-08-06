import { gzipSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compileBlck } from '../packages/porma-compiler/src/index.js'

const root = process.cwd()
const outfile = resolve(root, 'bench/out.js')

async function runEsbuild() {
  try {
    const esbuild = await import('esbuild')
    const { default: porma } = await import('../packages/porma-vite/src/index.js')

    const localPorma = {
      name: 'local-porma',
      setup(build) {
        build.onResolve({ filter: /^@blcklab\/porma(?:\/(.*))?$/ }, (args) => {
          const subpath = args.path.replace('@blcklab/porma', '').replace(/^\//, '')
          const file = subpath ? `packages/porma/src/${subpath}/index.js` : 'packages/porma/src/index.js'
          return { path: resolve(root, file) }
        })
      }
    }

    const result = await esbuild.build({
      entryPoints: [resolve(root, 'bench/main.js')],
      bundle: true,
      minify: true,
      format: 'esm',
      write: false,
      treeShaking: true,
      plugins: [localPorma, porma({ dev: false })]
    })

    const code = result.outputFiles[0].text
    writeFileSync(outfile, code)
    return {
      mode: 'esbuild',
      raw: Buffer.byteLength(code),
      gzip: gzipSync(code).length
    }
  } catch (error) {
    return null
  }
}

function simpleMinify(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}()[\],;:+\-*/%=<>])\s*/g, '$1')
    .trim()
}

function runFallback() {
  const source = readFileSync(resolve(root, 'bench/App.blck'), 'utf8')
  const compiled = compileBlck(source, {
    filename: 'bench/App.blck',
    dev: false
  }).code

  const modules = [
    'packages/porma/src/reactivity/index.js',
    'packages/porma/src/scope/index.js',
    'packages/porma/src/runtime/index.js',
    'packages/porma/src/dom/index.js',
    'packages/porma/src/index.js'
  ].map((file) => readFileSync(resolve(root, file), 'utf8')).join('\n')

  const code = simpleMinify(`${modules}\n${compiled}`)
  writeFileSync(outfile, code)

  return {
    mode: 'fallback-concat',
    raw: Buffer.byteLength(code),
    gzip: gzipSync(code).length
  }
}

const result = await runEsbuild() ?? runFallback()
console.log(`compiled .blck app bundle (${result.mode}): ${result.raw} bytes, ${result.gzip} bytes gzip`)
