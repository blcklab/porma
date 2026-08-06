#!/usr/bin/env node
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSION = '0.1.0-rc.3'
const TEMPLATES = new Set(['basic', 'typescript', 'router'])
const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')

function parseArgs(argv) {
  const options = {
    target: null,
    template: null,
    force: false,
    help: false
  }
  

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '-h' || arg === '--help') {
      options.help = true
      continue
    }

    if (arg === '-f' || arg === '--force') {
      options.force = true
      continue
    }

    if (arg === '--template' || arg === '-t') {
      options.template = argv[++i]
      continue
    }

    if (arg.startsWith('--template=')) {
      options.template = arg.slice('--template='.length)
      continue
    }

    if (!options.target) {
      options.target = arg
      continue
    }
  }

  return options
}

function printHelp() {
  console.log(`create-porma ${VERSION}\n\nUsage:\n  npm create porma@latest [project-name] -- [options]\n\nOptions:\n  -t, --template <name>   basic | typescript | router\n  -f, --force             overwrite target directory\n  -h, --help              show help\n\nExamples:\n  npm create porma@latest\n  npm create porma@latest my-app\n  npm create porma@latest my-app -- --template typescript`)
}

function normalizeProjectName(name) {
  return String(name || 'porma-app')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/^-+|-+$/g, '') || 'porma-app'
}

function isEmptyDirectory(path) {
  if (!existsSync(path)) return true
  return readdirSync(path).filter((entry) => !entry.startsWith('.DS_Store')).length === 0
}

function copyTemplate(from, to, replacements) {
  mkdirSync(to, { recursive: true })

  for (const entry of readdirSync(from)) {
    const source = join(from, entry)
    const outputName = entry === '_gitignore' ? '.gitignore' : entry
    const target = join(to, outputName)
    const stat = statSync(source)

    if (stat.isDirectory()) {
      copyTemplate(source, target, replacements)
      continue
    }

    let text = readFileSync(source, 'utf8')
    for (const [key, value] of Object.entries(replacements)) {
      text = text.replaceAll(`__${key}__`, value)
    }
    writeFileSync(target, text)
  }
}

async function promptMissing(options) {
  if (options.target && options.template) return options
  if (!input.isTTY) {
    options.target ??= 'porma-app'
    options.template ??= 'basic'
    return options
  }

  const rl = createInterface({ input, output })
  try {
    if (!options.target) {
      const answer = await rl.question('Project name: (porma-app) ')
      options.target = answer.trim() || 'porma-app'
    }

    if (!options.template) {
      const answer = await rl.question('Template: basic, typescript, router (basic) ')
      options.template = answer.trim() || 'basic'
    }
  } finally {
    rl.close()
  }

  return options
}

async function main() {
  const options = await promptMissing(parseArgs(process.argv.slice(2)))

  if (options.help) {
    printHelp()
    return
  }

  const projectName = normalizeProjectName(options.target)
  const template = options.template || 'basic'

  if (!TEMPLATES.has(template)) {
    console.error(`[create-porma] Unknown template "${template}". Choose: ${[...TEMPLATES].join(', ')}`)
    process.exit(1)
  }

  const targetDir = resolve(process.cwd(), projectName)

  if (existsSync(targetDir) && !isEmptyDirectory(targetDir)) {
    if (!options.force) {
      console.error(`[create-porma] Target directory is not empty: ${targetDir}`)
      console.error('Use --force to overwrite it.')
      process.exit(1)
    }
    rmSync(targetDir, { recursive: true, force: true })
  }

  const templateDir = join(packageRoot, 'templates', template)
  if (!existsSync(templateDir)) {
    console.error(`[create-porma] Missing template: ${template}`)
    process.exit(1)
  }

  copyTemplate(templateDir, targetDir, {
    PROJECT_NAME: projectName,
    PORMA_VERSION: VERSION
  })

  console.log(`\nCreated Porma app in ${targetDir}\n`)
  console.log('Next steps:')
  console.log(`  cd ${projectName}`)
  console.log('  npm install')
  console.log('  npm run dev')
  console.log('')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
