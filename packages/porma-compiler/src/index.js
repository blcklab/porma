const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const JS_KEYWORDS = new Set([
  'true', 'false', 'null', 'undefined', 'return', 'if', 'else', 'for', 'while', 'do', 'switch',
  'case', 'break', 'continue', 'const', 'let', 'var', 'function', 'class', 'new', 'this', 'typeof',
  'instanceof', 'in', 'of', 'await', 'async', 'yield', 'import', 'export', 'from', 'default',
  'try', 'catch', 'finally', 'throw', 'delete', 'void', 'super'
])
const JS_GLOBALS = new Set([
  'Array', 'Object', 'String', 'Number', 'Boolean', 'Math', 'Date', 'JSON', 'Promise', 'Set', 'Map',
  'WeakSet', 'WeakMap', 'console', 'window', 'document', 'localStorage', 'sessionStorage', 'URL',
  'URLSearchParams', 'Event', 'MouseEvent', 'KeyboardEvent', 'Node', 'Element', 'fetch'
])

const DOM_PROPERTIES = new Set(['value', 'checked', 'selected', 'disabled', 'readonly', 'readOnly', 'required', 'multiple'])


export function compileBlck(source, options = {}) {
  const filename = options.filename ?? 'Component.blck'
  const name = toComponentName(filename)
  const blocks = parseBlocks(source)
  const parseWarnings = (blocks.__diagnostics ?? []).map((diagnostic) => formatDiagnostic(diagnostic, filename))
  if (!('view' in blocks)) {
    parseWarnings.push(`[Porma] ${filename}: missing <view> block. The component will render an empty fragment.`)
  }
  const logicAttrs = blocks.__attrs?.logic ?? {}
  const styleAttrs = blocks.__attrs?.style ?? {}
  const logicLang = String(logicAttrs.lang ?? 'js').toLowerCase()
  const logicSource = isTypeScriptLang(logicLang)
    ? stripTypeScriptLogic(blocks.logic ?? '')
    : blocks.logic ?? ''
  const logic = splitLogic(logicSource)
  const parserMode = 'porma-scanner'
  const logicBindings = collectLogicBindings(logic.body)
  const propsVar = findPropsVariable(logic.body)
  const optionsLiteral = findDefineOptionsLiteral(logic.body)
  const inheritScope = /inheritScope\s*:\s*false/.test(optionsLiteral ?? '') ? false : true
  const scopedStyle = styleAttrs.scoped === true || styleAttrs.scoped === '' || styleAttrs.scoped === 'true'
  const scopeId = scopedStyle ? `data-porma-${hashString(`${filename}\n${blocks.style ?? ''}`).slice(0, 8)}` : null
  const css = blocks.style
    ? scopedStyle
      ? scopeCss(blocks.style, scopeId)
      : blocks.style
    : ''
  const styleId = css ? `porma-${hashString(`${filename}\n${css}`).slice(0, 8)}` : null
  const viewOffset = blocks.__ranges?.view?.contentStart ?? 0
  const viewAst = parseView(blocks.view ?? '', source, viewOffset)
  const warnings = [
    ...parseWarnings,
    ...((viewAst.diagnostics ?? []).map((diagnostic) => formatDiagnostic(diagnostic, filename)))
  ]
  const codegen = createCodegen({
    name,
    logicBindings,
    importBindings: logic.importBindings,
    propsVar,
    scopeAttr: scopeId,
    warnings,
    dev: Boolean(options.dev),
    filename,
    source
  })

  const renderCode = generateRender(viewAst, codegen)

  if (options.dev) {
    for (const key of [...codegen.scopeReferences].sort()) {
      warnings.push(`[Porma] ${name}: "${key}" is not declared locally or imported, so it will resolve from inherited scope at runtime.`)
    }
  }

  const exposeNames = logicBindings.filter((binding) => binding !== propsVar)
  const exposeCode = exposeNames.length
    ? `\n  exposeSetup(scope, { ${exposeNames.join(', ')} }, ${JSON.stringify(name)})`
    : ''

  if (css) {
    codegen.useDom('injectStyle')
  }

  const usedDomImports = [...codegen.domImports].sort()
  const usedRuntimeImports = new Set(['createComponent'])

  if (exposeNames.length) usedRuntimeImports.add('exposeSetup')
  if (/\bdefineProps\s*\(/.test(logic.body)) usedRuntimeImports.add('defineProps')
  if (/\bdefineOptions\s*\(/.test(logic.body)) usedRuntimeImports.add('defineOptions')
  if (/\bdefineInherits\s*(?:<[^>]+>)?\s*\(/.test(logic.body)) usedRuntimeImports.add('defineInherits')
  for (const item of codegen.runtimeImports) usedRuntimeImports.add(item)

  const domImport = usedDomImports.length
    ? `import { ${usedDomImports.join(', ')} } from '@blcklab/porma/dom'\n`
    : ''

  const runtimeImport = `import { ${[...usedRuntimeImports].sort().join(', ')} } from '@blcklab/porma/runtime'\n`
  const styleCode = css ? `\n  injectStyle(${JSON.stringify(styleId)}, ${JSON.stringify(css)})` : ''

  const code = `${runtimeImport}${domImport}${logic.imports.join('\n')}${logic.imports.length ? '\n' : ''}\nexport default /*#__PURE__*/ createComponent((scope, rawProps, instance) => {${styleCode}\n${indent(logic.body.trim(), 2)}${exposeCode}\n\n  return () => {\n${indent(renderCode.body, 4)}\n    return ${renderCode.result}\n  }\n}, { name: ${JSON.stringify(name)}, inheritScope: ${inheritScope} })\n`

  return {
    code,
    map: null,
    meta: {
      name,
      blocks: Object.keys(blocks),
      bindings: logicBindings,
      imports: logic.importBindings,
      domImports: usedDomImports,
      runtimeImports: [...usedRuntimeImports].sort(),
      inheritScope,
      logicLang,
      scopeId,
      scopedStyle,
      parserMode,
      warnings
    }
  }
}

export function parseBlocks(source) {
  const blocks = {}
  const blockAttrs = {}
  const blockRanges = {}
  const diagnostics = []
  const openPattern = /<(logic|view|style)\b([^>]*)>/gi
  let cursor = 0
  let match

  while ((match = openPattern.exec(source))) {
    if (match.index < cursor) continue

    const name = match[1].toLowerCase()
    const openStart = match.index
    const openEnd = openPattern.lastIndex
    const closePattern = new RegExp(`</${name}>`, 'i')
    const rest = source.slice(openEnd)
    const closeMatch = closePattern.exec(rest)

    if (!closeMatch) {
      diagnostics.push({
        level: 'warning',
        message: `unclosed <${name}> block`,
        position: lineColumn(source, openStart)
      })
      cursor = openEnd
      continue
    }

    const closeStart = openEnd + closeMatch.index
    const closeEnd = closeStart + closeMatch[0].length
    const rawContent = source.slice(openEnd, closeStart)
    const leading = rawContent.match(/^\s*/)?.[0].length ?? 0
    const trailing = rawContent.match(/\s*$/)?.[0].length ?? 0

    if (Object.prototype.hasOwnProperty.call(blocks, name)) {
      diagnostics.push({
        level: 'warning',
        message: `duplicate <${name}> block; the last one wins`,
        position: lineColumn(source, openStart)
      })
    }

    blocks[name] = rawContent.trim()
    blockAttrs[name] = parseBlockAttrs(match[2] ?? '')
    blockRanges[name] = {
      openStart,
      openEnd,
      contentStart: openEnd + leading,
      contentEnd: closeStart - trailing,
      closeStart,
      closeEnd
    }

    cursor = closeEnd
    openPattern.lastIndex = closeEnd
  }

  for (const diagnostic of findDanglingClosingBlockDiagnostics(source, blockRanges)) {
    diagnostics.push(diagnostic)
  }

  Object.defineProperty(blocks, '__attrs', {
    value: blockAttrs,
    enumerable: false
  })

  Object.defineProperty(blocks, '__ranges', {
    value: blockRanges,
    enumerable: false
  })

  Object.defineProperty(blocks, '__diagnostics', {
    value: diagnostics,
    enumerable: false
  })

  return blocks
}

function findDanglingClosingBlockDiagnostics(source, blockRanges) {
  const diagnostics = []
  const closePattern = /<\/(logic|view|style)>/gi
  let match

  while ((match = closePattern.exec(source))) {
    const closeStart = match.index
    const covered = Object.values(blockRanges).some((range) => range.closeStart === closeStart)

    if (!covered) {
      diagnostics.push({
        level: 'warning',
        message: `unexpected closing block </${match[1].toLowerCase()}>`,
        position: lineColumn(source, closeStart)
      })
    }
  }

  return diagnostics
}

function formatDiagnostic(diagnostic, filename = null) {
  const location = diagnostic.position
    ? `line ${diagnostic.position.line}, column ${diagnostic.position.column}`
    : 'unknown location'
  const prefix = filename ? `${filename}: ${location}` : location

  return `[Porma] ${prefix}: ${diagnostic.message}`
}

function lineColumn(source, offset) {
  const before = source.slice(0, offset)
  const lines = before.split('\n')

  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  }
}

function parseBlockAttrs(source) {
  const attrs = {}
  const pattern = /([A-Za-z_$][\w$:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
  let match

  while ((match = pattern.exec(source))) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? true
  }

  return attrs
}

function isTypeScriptLang(lang) {
  return lang === 'ts' || lang === 'tsx' || lang === 'typescript'
}

export function stripTypeScriptLogic(source) {
  let code = source

  code = removeDeclareLines(code)
  code = removeTypeOnlyImportsAndExports(code)
  code = cleanupTypeSpecifiersInImports(code)
  code = removeTypeBlocks(code, 'interface')
  code = removeTypeAliases(code)
  code = removeTsEnums(code)
  code = code.replace(/\bimport\s*\(\s*['"][^'"]+['"]\s*\)\s*\.\s*[A-Za-z_$][\w$]*/g, 'Object')
  code = removeGenericDeclarationParameters(code)
  code = removeGenericArgumentsBeforeCall(code)
  code = removeReturnTypes(code)
  code = removeFunctionParameterTypeAnnotations(code)
  code = removeArrowParameterTypeAnnotations(code)
  code = removeVariableTypeAnnotations(code)
  code = removeAssertionOperators(code)
  code = removeNonNullAssertions(code)

  return code.trim()
}

function removeDeclareLines(code) {
  return code.replace(/^\s*declare\s+[\s\S]*?(?:;|$)/gm, '')
}

function removeTypeOnlyImportsAndExports(code) {
  code = code.replace(/^\s*import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
  code = code.replace(/^\s*export\s+type\s+[\s\S]*?;?\s*$/gm, '')
  code = code.replace(/^\s*export\s+interface\s+[A-Za-z_$][\w$]*[\s\S]*?^\s*}\s*$/gm, '')
  return code
}

function removeTypeBlocks(code, keyword) {
  let output = ''
  let index = 0
  const pattern = new RegExp(`(?:export\\s+)?${keyword}\\s+[A-Za-z_$][\\w$]*(?:\\s+extends\\s+[^{]+)?\\s*{`, 'g')
  let match

  while ((match = pattern.exec(code))) {
    output += code.slice(index, match.index)
    let cursor = pattern.lastIndex
    let depth = 1

    while (cursor < code.length && depth > 0) {
      if (code[cursor] === '{') depth++
      if (code[cursor] === '}') depth--
      cursor++
    }

    while (code[cursor] === ';' || /\s/.test(code[cursor])) cursor++
    index = cursor
    pattern.lastIndex = cursor
  }

  return output + code.slice(index)
}

function removeTypeAliases(code) {
  let output = ''
  let index = 0
  const pattern = /(?:export\s+)?type\s+[A-Za-z_$][\w$]*(?:<[^>]*>)?\s*=/g
  let match

  while ((match = pattern.exec(code))) {
    output += code.slice(index, match.index)
    let cursor = pattern.lastIndex

    while (/\s/.test(code[cursor])) cursor++

    if (code[cursor] === '{') {
      cursor = findBalancedEnd(code, cursor, '{', '}') + 1
    } else {
      let angle = 0
      let bracket = 0
      let paren = 0
      let quote = null

      while (cursor < code.length) {
        const char = code[cursor]

        if (quote) {
          if (char === quote && code[cursor - 1] !== '\\') quote = null
          cursor++
          continue
        }

        if (char === '"' || char === "'" || char === '`') {
          quote = char
          cursor++
          continue
        }

        if (char === '<') angle++
        else if (char === '>') angle = Math.max(0, angle - 1)
        else if (char === '[') bracket++
        else if (char === ']') bracket = Math.max(0, bracket - 1)
        else if (char === '(') paren++
        else if (char === ')') paren = Math.max(0, paren - 1)
        else if ((char === ';' || char === '\n') && angle === 0 && bracket === 0 && paren === 0) {
          if (char === ';') cursor++
          break
        }

        cursor++
      }
    }

    while (code[cursor] === ';' || /\s/.test(code[cursor])) cursor++
    index = cursor
    pattern.lastIndex = cursor
  }

  return output + code.slice(index)
}

function removeTsEnums(code) {
  let output = ''
  let index = 0
  const pattern = /(?:export\s+)?(?:const\s+)?enum\s+[A-Za-z_$][\w$]*\s*{/g
  let match

  while ((match = pattern.exec(code))) {
    output += code.slice(index, match.index)
    const end = findBalancedEnd(code, pattern.lastIndex - 1, '{', '}')
    if (end === -1) break
    let cursor = end + 1
    while (code[cursor] === ';' || /\s/.test(code[cursor])) cursor++
    index = cursor
    pattern.lastIndex = cursor
  }

  return output + code.slice(index)
}

function cleanupTypeSpecifiersInImports(code) {
  return code.replace(/^\s*import\s+\{([^}]+)\}\s+from\s+(['"][^'"]+['"])\s*;?\s*$/gm, (match, members, from) => {
    const kept = members
      .split(',')
      .map((member) => member.trim())
      .filter((member) => member && !member.startsWith('type '))

    return kept.length ? `import { ${kept.join(', ')} } from ${from}` : ''
  })
}

function findBalancedEnd(code, start, open, close) {
  let depth = 0
  let quote = null

  for (let i = start; i < code.length; i++) {
    const char = code[i]

    if (quote) {
      if (char === quote && code[i - 1] !== '\\') quote = null
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === open) depth++
    if (char === close) {
      depth--
      if (depth === 0) return i
    }
  }

  return -1
}

function removeGenericDeclarationParameters(code) {
  code = code.replace(/\bfunction\s+([A-Za-z_$][\w$]*)\s*<[^>]+>\s*\(/g, 'function $1(')
  code = code.replace(/\bclass\s+([A-Za-z_$][\w$]*)\s*<[^>]+>/g, 'class $1')
  return code
}

function removeGenericArgumentsBeforeCall(code) {
  let output = ''
  let index = 0
  const pattern = /\b([A-Za-z_$][\w$]*)\s*</g
  let match

  while ((match = pattern.exec(code))) {
    const angleStart = code.indexOf('<', match.index)
    const angleEnd = findMatchingAngle(code, angleStart)

    if (angleEnd === -1) continue

    let cursor = angleEnd + 1
    while (/\s/.test(code[cursor])) cursor++

    if (code[cursor] !== '(') continue

    output += code.slice(index, match.index) + match[1]
    index = angleEnd + 1
    pattern.lastIndex = angleEnd + 1
  }

  return output + code.slice(index)
}

function findMatchingAngle(code, start) {
  let depth = 0
  let quote = null

  for (let i = start; i < code.length; i++) {
    const char = code[i]

    if (quote) {
      if (char === quote && code[i - 1] !== '\\') quote = null
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '<') depth++
    if (char === '>' && code[i - 1] !== '=') {
      depth--
      if (depth === 0) return i
    }
  }

  return -1
}

function removeVariableTypeAnnotations(code) {
  code = code.replace(/\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*:\s*([^=;\n]+)(?=\s*=|\s*;|\s*$)/gm, '$1 $2')
  code = code.replace(/\b(const|let|var)\s+(\{[^\n=]+\}|\[[^\n=]+\])\s*:\s*([^=;\n]+)(?=\s*=)/gm, '$1 $2')
  return code
}

function removeReturnTypes(code) {
  code = code.replace(/(\)\s*):\s*([^={;\n]+)(?=\s*(?:=>|\{|;|$))/g, '$1')
  return code
}

function removeFunctionParameterTypeAnnotations(code) {
  return code.replace(/function(\s+[A-Za-z_$][\w$]*\s*)\(([^)]*)\)/g, (_, name, params) => {
    return `function${name}(${stripParamTypes(params)})`
  })
}

function removeArrowParameterTypeAnnotations(code) {
  code = code.replace(/\(([^)]*)\)\s*=>/g, (_, params) => `(${stripParamTypes(params)}) =>`)
  code = code.replace(/\(([^)]*)\)\s*:\s*[^=;\n]+\s*=>/g, (_, params) => `(${stripParamTypes(params)}) =>`)
  code = code.replace(/=\s*<[^>]+>\s*\(([^)]*)\)\s*=>/g, (_, params) => `= (${stripParamTypes(params)}) =>`)
  code = code.replace(/=\s*<[^>]+>\s*\(([^)]*)\)\s*:\s*[^=;\n]+\s*=>/g, (_, params) => `= (${stripParamTypes(params)}) =>`)
  return code
}

function stripParamTypes(params) {
  return splitTopLevel(params, ',')
    .map((param) => stripOneParamType(param.trim()))
    .join(', ')
}

function stripOneParamType(param) {
  if (!param) return param
  const eqIndex = findTopLevelChar(param, '=')
  const left = eqIndex === -1 ? param : param.slice(0, eqIndex).trim()
  const fallback = eqIndex === -1 ? '' : param.slice(eqIndex)
  const colonIndex = findTopLevelChar(left, ':')
  const namePart = colonIndex === -1 ? left : left.slice(0, colonIndex).trim()
  return namePart.replace(/\?$/, '') + fallback
}

function removeAssertionOperators(code) {
  return code
    .split('\n')
    .map((line) => {
      if (/^\s*import\s/.test(line)) return line
      return stripLineAssertionOperators(line)
    })
    .join('\n')
}

function stripLineAssertionOperators(line) {
  return stripTypeOperator(line, 'as').replace(/\s+satisfies\s+[^,;)\]}]+/g, '')
}

function stripTypeOperator(line, operator) {
  let output = ''
  let index = 0
  const pattern = new RegExp(`\\s+${operator}\\s+`, 'g')
  let match

  while ((match = pattern.exec(line))) {
    output += line.slice(index, match.index)
    let cursor = pattern.lastIndex
    let angle = 0
    let bracket = 0
    let paren = 0

    while (cursor < line.length) {
      const char = line[cursor]
      if (char === '<') angle++
      else if (char === '>') angle = Math.max(0, angle - 1)
      else if (char === '[') bracket++
      else if (char === ']') {
        if (bracket === 0 && angle === 0 && paren === 0) break
        bracket = Math.max(0, bracket - 1)
      } else if (char === '(') paren++
      else if (char === ')') {
        if (paren === 0 && angle === 0 && bracket === 0) break
        paren = Math.max(0, paren - 1)
      } else if ((char === ',' || char === ';') && angle === 0 && bracket === 0 && paren === 0) {
        break
      }
      cursor++
    }

    index = cursor
    pattern.lastIndex = cursor
  }

  return output + line.slice(index)
}

function removeNonNullAssertions(code) {
  code = code.replace(/([A-Za-z_$][\w$]*)!(?=\.)/g, '$1')
  code = code.replace(/([A-Za-z_$][\w$]*)!(?=\s*(?:[,;)\]}]|$))/g, '$1')
  return code
}

function splitLogic(logic) {
  const imports = []
  const bodyLines = []
  const importBindings = []
  const lines = logic.split('\n')

  for (const line of lines) {
    if (/^\s*import\s/.test(line)) {
      imports.push(line.trim())
      importBindings.push(...collectImportBindings(line))
    } else {
      bodyLines.push(line)
    }
  }

  return {
    imports,
    importBindings,
    body: bodyLines.join('\n').trim()
  }
}

function collectImportBindings(line) {
  const bindings = []
  const defaultMatch = line.match(/^\s*import\s+([A-Za-z_$][\w$]*)\s+from/)

  if (defaultMatch) bindings.push(defaultMatch[1])

  const namespaceMatch = line.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/)

  if (namespaceMatch) bindings.push(namespaceMatch[1])

  const namedMatch = line.match(/\{([^}]+)\}/)

  if (namedMatch) {
    for (const item of namedMatch[1].split(',')) {
      const cleaned = item.trim()
      if (!cleaned) continue
      const alias = cleaned.match(/\s+as\s+([A-Za-z_$][\w$]*)$/)
      bindings.push(alias ? alias[1] : cleaned.split(/\s+/)[0])
    }
  }

  return bindings
}

function collectLogicBindings(body) {
  const bindings = new Set()
  let index = 0
  let braceDepth = 0
  let parenDepth = 0
  let bracketDepth = 0
  let quote = null
  let lineComment = false
  let blockComment = false

  while (index < body.length) {
    const char = body[index]
    const next = body[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      index++
      continue
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 2
      } else {
        index++
      }
      continue
    }

    if (quote) {
      if (quote === '`' && char === '$' && next === '{') {
        // Template expressions can contain declarations, but they are not
        // component-scope declarations. Skip them as part of the string.
        index += 2
        continue
      }

      if (char === quote && body[index - 1] !== '\\') quote = null
      index++
      continue
    }

    if (char === '/' && next === '/') {
      lineComment = true
      index += 2
      continue
    }

    if (char === '/' && next === '*') {
      blockComment = true
      index += 2
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      index++
      continue
    }

    const isTopLevel = braceDepth === 0 && parenDepth === 0 && bracketDepth === 0

    if (isTopLevel && startsWithWord(body, index, 'function')) {
      const name = readWordAfterKeyword(body, index + 'function'.length)
      if (name) bindings.add(name.value)
      index = name?.end ?? index + 'function'.length
      continue
    }

    if (isTopLevel && startsWithWord(body, index, 'class')) {
      const name = readWordAfterKeyword(body, index + 'class'.length)
      if (name) bindings.add(name.value)
      index = name?.end ?? index + 'class'.length
      continue
    }

    if (isTopLevel && (startsWithWord(body, index, 'const') || startsWithWord(body, index, 'let') || startsWithWord(body, index, 'var'))) {
      const keyword = body.startsWith('const', index) ? 'const' : body.startsWith('let', index) ? 'let' : 'var'
      const result = collectVariableDeclarationBindings(body, index + keyword.length)
      for (const name of result.names) bindings.add(name)
      index = result.end
      continue
    }

    if (char === '{') braceDepth++
    else if (char === '}') braceDepth = Math.max(0, braceDepth - 1)
    else if (char === '(') parenDepth++
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1)
    else if (char === '[') bracketDepth++
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1)

    index++
  }

  return [...bindings]
}

function startsWithWord(source, index, word) {
  if (!source.startsWith(word, index)) return false

  const before = source[index - 1]
  const after = source[index + word.length]

  return !isIdentifierPart(before) && !isIdentifierPart(after)
}

function readWordAfterKeyword(source, index) {
  index = skipWhitespace(source, index)

  if (!isIdentifierStart(source[index])) return null

  const start = index
  index++

  while (isIdentifierPart(source[index])) index++

  return {
    value: source.slice(start, index),
    end: index
  }
}

function collectVariableDeclarationBindings(source, index) {
  const names = []
  let cursor = index

  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor)
    if (source[cursor] === ';') return { names, end: cursor + 1 }
    if (source[cursor] === '\n') return { names, end: cursor + 1 }

    const patternStart = cursor

    if (source[cursor] === '{') {
      cursor = findBalancedEnd(source, cursor, '{', '}') + 1
    } else if (source[cursor] === '[') {
      cursor = findBalancedEnd(source, cursor, '[', ']') + 1
    } else if (isIdentifierStart(source[cursor])) {
      cursor++
      while (isIdentifierPart(source[cursor])) cursor++
    } else {
      return { names, end: cursor + 1 }
    }

    const pattern = source.slice(patternStart, cursor).trim()
    for (const name of collectNamesFromBindingPattern(pattern)) names.push(name)

    cursor = skipWhitespace(source, cursor)

    if (source[cursor] === '=') {
      cursor = skipInitializer(source, cursor + 1)
    }

    cursor = skipWhitespace(source, cursor)

    if (source[cursor] === ',') {
      cursor++
      continue
    }

    if (source[cursor] === ';') {
      cursor++
      break
    }

    if (source[cursor] === '\n') {
      cursor++
      break
    }

    break
  }

  return { names, end: cursor }
}

function collectNamesFromBindingPattern(pattern) {
  pattern = pattern.trim()

  if (/^[A-Za-z_$][\w$]*$/.test(pattern)) return [pattern]

  if (pattern.startsWith('{') && pattern.endsWith('}')) {
    const names = []
    for (const part of splitTopLevel(pattern.slice(1, -1), ',')) {
      const segment = part.trim()
      if (!segment) continue

      if (segment.startsWith('...')) {
        names.push(...collectNamesFromBindingPattern(segment.slice(3).trim()))
        continue
      }

      const colonIndex = findTopLevelChar(segment, ':')
      const target = colonIndex === -1 ? segment : segment.slice(colonIndex + 1)
      const withoutDefault = stripTopLevelDefault(target.trim())
      names.push(...collectNamesFromBindingPattern(withoutDefault))
    }

    return names
  }

  if (pattern.startsWith('[') && pattern.endsWith(']')) {
    const names = []
    for (const part of splitTopLevel(pattern.slice(1, -1), ',')) {
      const segment = stripTopLevelDefault(part.trim().replace(/^\.\.\./, ''))
      if (segment) names.push(...collectNamesFromBindingPattern(segment))
    }

    return names
  }

  return []
}

function skipInitializer(source, index) {
  let cursor = index
  let braceDepth = 0
  let parenDepth = 0
  let bracketDepth = 0
  let quote = null
  let lineComment = false
  let blockComment = false

  while (cursor < source.length) {
    const char = source[cursor]
    const next = source[cursor + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      cursor++
      continue
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        cursor += 2
      } else {
        cursor++
      }
      continue
    }

    if (quote) {
      if (char === quote && source[cursor - 1] !== '\\') quote = null
      cursor++
      continue
    }

    if (char === '/' && next === '/') {
      lineComment = true
      cursor += 2
      continue
    }

    if (char === '/' && next === '*') {
      blockComment = true
      cursor += 2
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      cursor++
      continue
    }

    if (char === '{') braceDepth++
    else if (char === '}') braceDepth = Math.max(0, braceDepth - 1)
    else if (char === '(') parenDepth++
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1)
    else if (char === '[') bracketDepth++
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1)

    const isFlat = braceDepth === 0 && parenDepth === 0 && bracketDepth === 0
    if (isFlat && (char === ',' || char === ';' || char === '\n')) return cursor

    cursor++
  }

  return cursor
}

function splitTopLevel(source, separator) {
  const parts = []
  let start = 0
  let braceDepth = 0
  let parenDepth = 0
  let bracketDepth = 0
  let quote = null

  for (let index = 0; index < source.length; index++) {
    const char = source[index]

    if (quote) {
      if (char === quote && source[index - 1] !== '\\') quote = null
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '{') braceDepth++
    else if (char === '}') braceDepth--
    else if (char === '(') parenDepth++
    else if (char === ')') parenDepth--
    else if (char === '[') bracketDepth++
    else if (char === ']') bracketDepth--
    else if (char === separator && braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
      parts.push(source.slice(start, index))
      start = index + 1
    }
  }

  parts.push(source.slice(start))
  return parts
}

function findTopLevelChar(source, target) {
  let braceDepth = 0
  let parenDepth = 0
  let bracketDepth = 0
  let quote = null

  for (let index = 0; index < source.length; index++) {
    const char = source[index]

    if (quote) {
      if (char === quote && source[index - 1] !== '\\') quote = null
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '{') braceDepth++
    else if (char === '}') braceDepth--
    else if (char === '(') parenDepth++
    else if (char === ')') parenDepth--
    else if (char === '[') bracketDepth++
    else if (char === ']') bracketDepth--
    else if (char === target && braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
      return index
    }
  }

  return -1
}

function stripTopLevelDefault(source) {
  const index = findTopLevelChar(source, '=')
  return index === -1 ? source.trim() : source.slice(0, index).trim()
}

function skipWhitespace(source, index) {
  while (/\s/.test(source[index])) index++
  return index
}

function isIdentifierStart(char) {
  return typeof char === 'string' && /[A-Za-z_$]/.test(char)
}

function isIdentifierPart(char) {
  return typeof char === 'string' && /[A-Za-z0-9_$]/.test(char)
}

function findPropsVariable(body) {
  const match = body.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*defineProps\s*\(/)
  return match ? match[1] : null
}

function findDefineOptionsLiteral(body) {
  const match = body.match(/defineOptions\s*\((\{[\s\S]*?\})\s*\)/)
  return match ? match[1] : null
}

function parseView(view, fullSource = view, baseOffset = 0) {
  const root = { type: 'root', children: [], diagnostics: [] }
  const stack = [root]
  let index = 0

  function warn(message, offset = index) {
    root.diagnostics.push({
      level: 'warning',
      message,
      position: lineColumn(fullSource, baseOffset + Math.max(0, Math.min(offset, view.length)))
    })
  }

  while (index < view.length) {
    if (view.startsWith('<!--', index)) {
      const end = view.indexOf('-->', index + 4)
      if (end === -1) {
        warn('unclosed HTML comment in <view>', index)
        break
      }
      index = end + 3
      continue
    }

    if (view[index] === '<') {
      if (view[index + 1] === '/') {
        const end = view.indexOf('>', index)
        if (end === -1) {
          warn('unclosed closing tag in <view>', index)
          break
        }

        const tag = view.slice(index + 2, end).trim()
        let foundAt = -1

        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i].tag === tag) {
            foundAt = i
            break
          }
        }

        if (foundAt === -1) {
          warn(`unexpected closing tag </${tag}>`, index)
        } else {
          if (foundAt !== stack.length - 1) {
            for (let i = stack.length - 1; i > foundAt; i--) {
              warn(`unclosed <${stack[i].tag}> tag before </${tag}>`, index)
            }
          }
          while (stack.length - 1 >= foundAt) stack.pop()
        }

        index = end + 1
        continue
      }

      const end = findTagEnd(view, index)
      if (end === -1) {
        warn('unclosed opening tag in <view>', index)
        break
      }

      const raw = view.slice(index + 1, end)
      const selfClosing = /\/\s*$/.test(raw)
      const clean = raw.replace(/\/\s*$/, '').trim()
      const firstSpace = clean.search(/\s/)
      const tag = firstSpace === -1 ? clean : clean.slice(0, firstSpace)
      const attrSource = firstSpace === -1 ? '' : clean.slice(firstSpace + 1)

      if (!tag) {
        warn('empty tag in <view>', index)
        index = end + 1
        continue
      }

      const attrOffset = firstSpace === -1 ? end : index + 1 + firstSpace + 1
      const node = {
        type: 'element',
        tag,
        attrs: parseAttrs(attrSource, root.diagnostics, fullSource, baseOffset + attrOffset),
        children: []
      }

      stack[stack.length - 1].children.push(node)

      if (!selfClosing && !VOID_TAGS.has(tag.toLowerCase())) {
        stack.push(node)
      }

      index = end + 1
      continue
    }

    const next = view.indexOf('<', index)
    const end = next === -1 ? view.length : next
    const content = view.slice(index, end)

    if (content.trim()) {
      stack[stack.length - 1].children.push({
        type: 'text',
        value: content,
        offset: baseOffset + index
      })
    }

    index = end
  }

  for (let i = stack.length - 1; i > 0; i--) {
    warn(`unclosed <${stack[i].tag}> tag in <view>`, view.length)
  }

  return root
}

function findTagEnd(view, start) {
  let quote = null
  let braceDepth = 0

  for (let i = start + 1; i < view.length; i++) {
    const char = view[i]

    if (quote) {
      if (char === quote && view[i - 1] !== '\\') quote = null
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '{') braceDepth++
    if (char === '}') braceDepth--

    if (char === '>' && braceDepth === 0) return i
  }

  return -1
}

function parseAttrs(source, diagnostics = null, fullSource = source, baseOffset = 0) {
  const attrs = []
  const seen = new Set()
  let index = 0

  function warn(message, localOffset = index) {
    diagnostics?.push({
      level: 'warning',
      message,
      position: lineColumn(fullSource, baseOffset + localOffset)
    })
  }

  function pushAttr(attr, localOffset = index) {
    if (seen.has(attr.name)) {
      warn(`duplicate attribute "${attr.name}" in <view>; the last generated binding wins`, localOffset)
    }

    seen.add(attr.name)
    attrs.push(attr)
  }

  while (index < source.length) {
    while (/\s/.test(source[index])) index++
    if (index >= source.length) break

    const nameStart = index
    while (index < source.length && /[^\s=]/.test(source[index])) index++
    const name = source.slice(nameStart, index)

    if (!/^[A-Za-z_:][A-Za-z0-9_:.@-]*$/.test(name)) {
      warn(`invalid attribute name "${name}"`, nameStart)
    }

    while (/\s/.test(source[index])) index++

    if (source[index] !== '=') {
      pushAttr({ name, kind: 'boolean', value: true }, nameStart)
      continue
    }

    index++
    while (/\s/.test(source[index])) index++

    const char = source[index]

    if (char === '"' || char === "'") {
      const quote = char
      index++
      const start = index
      while (index < source.length && source[index] !== quote) index++
      if (index >= source.length) {
        warn(`unclosed quoted attribute value for "${name}"`, start - 1)
        pushAttr({ name, kind: 'static', value: source.slice(start) }, nameStart)
        break
      }
      pushAttr({ name, kind: 'static', value: source.slice(start, index) }, nameStart)
      index++
      continue
    }

    if (char === '{') {
      const start = index + 1
      const closeIndex = findBalancedExpressionEnd(source, index)

      if (closeIndex === -1) {
        warn(`unclosed dynamic attribute expression for "${name}"`, index)
        pushAttr({ name, kind: 'dynamic', value: source.slice(start).trim() }, nameStart)
        break
      }

      const expression = source.slice(start, closeIndex).trim()
      const expressionWarning = validateViewExpression(expression)
      if (expressionWarning) warn(`${expressionWarning} for dynamic attribute "${name}"`, start)
      pushAttr({ name, kind: 'dynamic', value: expression }, nameStart)
      index = closeIndex + 1
      continue
    }

    const start = index
    while (index < source.length && !/\s/.test(source[index])) index++
    pushAttr({ name, kind: 'static', value: source.slice(start, index) }, nameStart)
  }

  return attrs
}

function createCodegen(context) {
  return {
    ...context,
    index: 0,
    domImports: new Set(),
    runtimeImports: new Set(),
    localBindings: new Set(),
    scopeReferences: new Set(),
    next(prefix) {
      return `_${prefix}${this.index++}`
    },
    use(name) {
      return this.useDom(name)
    },
    useDom(name) {
      this.domImports.add(name)
      return name
    },
    useRuntime(name) {
      this.runtimeImports.add(name)
      return name
    }
  }
}

function generateRender(ast, codegen) {
  const body = []
  let result

  if (ast.children.length === 1) {
    const generated = generateNode(ast.children[0], codegen, body)
    result = generated
  } else {
    codegen.use('fragment')
    const frag = codegen.next('frag')
    body.push(`const ${frag} = fragment()`)

    for (const child of ast.children) {
      const generated = generateNode(child, codegen, body)
      codegen.use('append')
      body.push(`append(${frag}, ${generated})`)
    }

    result = frag
  }

  return {
    body: body.join('\n'),
    result
  }
}

function generateNode(node, codegen, body) {
  if (node.type === 'text') {
    return generateText(node.value, codegen, body, node.offset)
  }

  const loopAttr = getLoopAttr(node)
  if (loopAttr) {
    return generateLoop(node, loopAttr, codegen, body)
  }

  const ifAttr = getAttr(node, 'if')
  if (ifAttr) {
    return generateIf(node, ifAttr, codegen, body)
  }

  if (isComponentTag(node.tag)) {
    return generateComponent(node, codegen, body)
  }

  return generateElement(node, codegen, body)
}

function generateLoop(node, loopAttr, codegen, body) {
  const loop = codegen.next('loop')
  const parsed = safeParseLoopExpression(loopAttr.value, codegen)

  if (!parsed) {
    codegen.use('fragment')
    body.push(`const ${loop} = fragment()`)
    return loop
  }

  codegen.use('bindList')

  const cloned = cloneElementWithoutAttrs(node, ['loop', 'key'])
  const keyAttr = getAttr(node, 'key')
  const sourceExpression = scopeExpression(parsed.source, codegen)
  const indexName = parsed.index ?? '_index'
  const childBody = []

  const generated = withLocalBindings(codegen, [parsed.item, indexName], () => {
    return generateNode(cloned, codegen, childBody)
  })

  let keyCode = 'null'

  if (keyAttr) {
    keyCode = withLocalBindings(codegen, [parsed.item, indexName], () => {
      return `(${parsed.item}, ${indexName}) => ${directiveExpression(keyAttr, codegen)}`
    })
  } else {
    codegen.warnings.push(`[Porma] ${codegen.filename}: loop="${loopAttr.value}" in ${codegen.name} has no key. Add key={${parsed.item}.id} or another stable key for efficient updates.`)
  }

  body.push(`const ${loop} = bindList(() => ${sourceExpression}, (${parsed.item}, ${indexName}) => {\n${indent(childBody.join('\n'), 2)}\n  return ${generated}\n}, ${keyCode})`)
  return loop
}

function generateIf(node, ifAttr, codegen, body) {
  codegen.use('bindIf')

  const ifNode = codegen.next('if')
  const cloned = cloneElementWithoutAttrs(node, ['if'])
  const childBody = []
  const generated = generateNode(cloned, codegen, childBody)

  body.push(`const ${ifNode} = bindIf(() => ${directiveExpression(ifAttr, codegen)}, () => {\n${indent(childBody.join('\n'), 2)}\n  return ${generated}\n})`)
  return ifNode
}

function generateElement(node, codegen, body) {
  codegen.use('element')
  const el = codegen.next('el')
  body.push(`const ${el} = element(${JSON.stringify(node.tag)})`)

  if (codegen.scopeAttr) {
    codegen.use('setAttr')
    body.push(`setAttr(${el}, ${JSON.stringify(codegen.scopeAttr)}, true)`)
  }

  for (const attr of node.attrs) {
    generateAttr(el, attr, codegen, body)
  }

  for (const child of node.children) {
    const generated = generateNode(child, codegen, body)
    codegen.use('append')
    body.push(`append(${el}, ${generated})`)
  }

  return el
}

function generateComponent(node, codegen, body) {
  codegen.use('mountChild')
  const cmp = codegen.next('cmp')
  const props = []

  for (const attr of node.attrs) {
    if (attr.name === 'isolate' && attr.kind === 'boolean') {
      props.push('isolate: true')
      continue
    }

    if (attr.kind === 'dynamic') {
      props.push(`${safeObjectKey(attr.name)}: ${scopeExpression(attr.value, codegen)}`)
    } else if (attr.kind === 'boolean') {
      props.push(`${safeObjectKey(attr.name)}: true`)
    } else {
      props.push(`${safeObjectKey(attr.name)}: ${JSON.stringify(attr.value)}`)
    }
  }

  body.push(`const ${cmp} = mountChild(${scopeExpression(node.tag, codegen)}, { ${props.join(', ')} }, scope)`)
  return cmp
}

function generateText(value, codegen, body, offset = null) {
  codegen.use('textNode')
  const text = codegen.next('text')
  const parts = splitInterpolations(value, codegen, offset)

  if (parts.length === 1 && parts[0].type === 'static') {
    body.push(`const ${text} = textNode(${JSON.stringify(parts[0].value)})`)
    return text
  }

  body.push(`const ${text} = textNode()`)
  codegen.use('bindText')
  body.push(`bindText(${text}, () => ${generateTextExpression(parts, codegen)})`)
  return text
}

function generateAttr(el, attr, codegen, body) {
  if (attr.name === 'if' || attr.name === 'key') return
  if (isLoopAttr(attr)) return

  if (attr.name === 'show') {
    codegen.use('bindShow')
    body.push(`bindShow(${el}, () => ${directiveExpression(attr, codegen)})`)
    return
  }

  if (isNativeEventAttr(attr.name)) {
    codegen.use('bindEvent')
    const handler = attr.kind === 'dynamic'
      ? scopeExpression(attr.value, codegen)
      : attr.value
    body.push(`bindEvent(${el}, ${JSON.stringify(nativeEventName(attr.name))}, ${handler})`)
    return
  }

  if (attr.kind === 'dynamic') {
    if (DOM_PROPERTIES.has(attr.name)) {
      codegen.use('bindProperty')
      body.push(`bindProperty(${el}, ${JSON.stringify(attr.name)}, () => ${scopeExpression(attr.value, codegen)})`)
      return
    }

    codegen.use('bindAttr')
    body.push(`bindAttr(${el}, ${JSON.stringify(attr.name)}, () => ${scopeExpression(attr.value, codegen)})`)
    return
  }

  if (DOM_PROPERTIES.has(attr.name)) {
    codegen.use('setProperty')
    body.push(`setProperty(${el}, ${JSON.stringify(attr.name)}, ${JSON.stringify(attr.kind === 'boolean' ? true : attr.value)})`)
    return
  }

  codegen.use('setAttr')
  body.push(`setAttr(${el}, ${JSON.stringify(attr.name)}, ${JSON.stringify(attr.kind === 'boolean' ? true : attr.value)})`)
}


function getAttr(node, name) {
  return node.attrs.find((attr) => attr.name === name) ?? null
}

function getLoopAttr(node) {
  return node.attrs.find((attr) => attr.name === 'loop' && attr.kind !== 'boolean') ?? null
}

function isLoopAttr(attr) {
  return attr.name === 'loop' && attr.kind !== 'boolean'
}

function cloneElementWithoutAttrs(node, names) {
  const blocked = new Set(names)

  return {
    ...node,
    attrs: node.attrs.filter((attr) => !blocked.has(attr.name)),
    children: node.children
  }
}

function safeParseLoopExpression(value, codegen) {
  try {
    return parseLoopExpression(value)
  } catch (error) {
    codegen.warnings.push(`[Porma] ${codegen.filename}: ${error.message}`)
    return null
  }
}

function parseLoopExpression(value) {
  const source = String(value).trim()
  const match = source.match(/^\s*(?:\(([^)]+)\)|([A-Za-z_$][\w$]*))\s+in\s+([\s\S]+?)\s*$/)

  if (!match) {
    throw new SyntaxError(`Invalid loop expression: ${value}`)
  }

  const left = match[1] ?? match[2]
  const parts = left.split(',').map((part) => part.trim()).filter(Boolean)
  const item = parts[0]
  const index = parts[1] ?? null

  if (!/^[A-Za-z_$][\w$]*$/.test(item)) {
    throw new SyntaxError(`Invalid loop item name: ${item}`)
  }

  if (index && !/^[A-Za-z_$][\w$]*$/.test(index)) {
    throw new SyntaxError(`Invalid loop index name: ${index}`)
  }

  return {
    item,
    index,
    source: match[3].trim()
  }
}

function directiveExpression(attr, codegen) {
  if (attr.kind === 'boolean') return 'true'
  return scopeExpression(String(attr.value), codegen)
}

function withLocalBindings(codegen, names, fn) {
  const previous = codegen.localBindings
  codegen.localBindings = new Set([...previous, ...names.filter(Boolean)])

  try {
    return fn()
  } finally {
    codegen.localBindings = previous
  }
}

function isNativeEventAttr(name) {
  return name.startsWith('on.')
}

function nativeEventName(name) {
  return name.slice(3)
}


function warnCodegen(codegen, message, absoluteOffset = null) {
  if (!codegen) return

  const diagnostic = {
    level: 'warning',
    message,
    position: absoluteOffset == null ? null : lineColumn(codegen.source, absoluteOffset)
  }

  codegen.warnings.push(formatDiagnostic(diagnostic, codegen.filename))
}

function findBalancedExpressionEnd(source, start) {
  let depth = 0
  let quote = null
  let lineComment = false
  let blockComment = false

  for (let index = start; index < source.length; index++) {
    const char = source[index]
    const next = source[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index++
      }
      continue
    }

    if (quote) {
      if (char === quote && source[index - 1] !== '\\') quote = null
      continue
    }

    if (char === '/' && next === '/') {
      lineComment = true
      index++
      continue
    }

    if (char === '/' && next === '*') {
      blockComment = true
      index++
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '{') depth++
    if (char === '}') {
      depth--
      if (depth === 0) return index
    }
  }

  return -1
}

function validateViewExpression(expression) {
  if (!expression.trim()) return 'empty expression'
  if (/;/.test(expression)) return 'view expressions should be expressions, not statements'
  if (/\b(?:const|let|var|function|class|return|throw|import|export)\b/.test(expression)) {
    return 'view expressions cannot contain declarations or statements'
  }

  let paren = 0
  let bracket = 0
  let brace = 0
  let quote = null

  for (let index = 0; index < expression.length; index++) {
    const char = expression[index]

    if (quote) {
      if (char === quote && expression[index - 1] !== '\\') quote = null
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '(') paren++
    else if (char === ')') paren--
    else if (char === '[') bracket++
    else if (char === ']') bracket--
    else if (char === '{') brace++
    else if (char === '}') brace--

    if (paren < 0 || bracket < 0 || brace < 0) return 'unbalanced expression'
  }

  if (quote) return 'unclosed string in expression'
  if (paren !== 0 || bracket !== 0 || brace !== 0) return 'unbalanced expression'

  return null
}

function splitInterpolations(value, codegen = null, absoluteOffset = null) {
  const parts = []
  let index = 0

  while (index < value.length) {
    const start = value.indexOf('{', index)

    if (start === -1) {
      if (value.slice(index)) parts.push({ type: 'static', value: value.slice(index) })
      break
    }

    if (start > index) {
      parts.push({ type: 'static', value: value.slice(index, start) })
    }

    const closeIndex = findBalancedExpressionEnd(value, start)

    if (closeIndex === -1) {
      warnCodegen(codegen, 'unclosed text interpolation in <view>', absoluteOffset == null ? null : absoluteOffset + start)
      parts.push({ type: 'static', value: value.slice(start) })
      break
    }

    const expression = value.slice(start + 1, closeIndex).trim()
    const expressionWarning = validateViewExpression(expression)
    if (!expression) {
      warnCodegen(codegen, 'empty text interpolation in <view>', absoluteOffset == null ? null : absoluteOffset + start)
    } else if (expressionWarning) {
      warnCodegen(codegen, `${expressionWarning} in text interpolation`, absoluteOffset == null ? null : absoluteOffset + start + 1)
      parts.push({ type: 'expr', value: expression })
    } else {
      parts.push({ type: 'expr', value: expression })
    }

    index = closeIndex + 1
  }

  return parts
}

function generateTextExpression(parts, codegen) {
  codegen.useRuntime('read')

  return parts.map((part) => {
    if (part.type === 'static') return JSON.stringify(part.value)
    return `read(${scopeExpression(part.value, codegen)})`
  }).join(' + ')
}

function scopeExpression(expression, codegen) {
  const known = new Set([
    ...codegen.logicBindings,
    ...codegen.importBindings,
    ...codegen.localBindings,
    'scope',
    'rawProps',
    'instance',
    'props',
    'read'
  ])

  const arrowParams = collectArrowParams(expression)
  for (const param of arrowParams) known.add(param)

  const masks = []
  let masked = expression.replace(/(['"`])(?:\\.|(?!\1)[\s\S])*\1/g, (match) => {
    const id = `__PORMA_STRING_${masks.length}__`
    masks.push(match)
    return id
  })

  masked = masked.replace(/\b[A-Za-z_$][\w$]*\b/g, (id, offset, full) => {
    if (id.startsWith('__PORMA_STRING_')) return id
    if (JS_KEYWORDS.has(id) || JS_GLOBALS.has(id) || known.has(id)) return id

    const previous = full[offset - 1]
    const next = full.slice(offset + id.length).match(/^\s*[:(]/)?.[0]

    if (previous === '.') return id
    if (next && next.trim() === ':' && isProbablyObjectKey(full, offset)) return id

    codegen.scopeReferences.add(id)
    if (codegen.dev) {
      codegen.useRuntime('readScope')
      return `readScope(scope, ${JSON.stringify(id)}, ${JSON.stringify(codegen.name)})`
    }
    return `scope.${id}`
  })

  for (let i = 0; i < masks.length; i++) {
    masked = masked.replace(`__PORMA_STRING_${i}__`, masks[i])
  }

  return masked
}

function collectArrowParams(expression) {
  const params = new Set()
  let match
  const arrow = /(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*=>/g

  while ((match = arrow.exec(expression))) {
    const raw = match[1] ?? match[2]
    for (const part of raw.split(',')) {
      const name = part.trim().replace(/=.*$/, '').trim()
      if (/^[A-Za-z_$][\w$]*$/.test(name)) params.add(name)
    }
  }

  return params
}

function isProbablyObjectKey(full, offset) {
  let i = offset - 1

  while (i >= 0 && /\s/.test(full[i])) i--

  return full[i] === '{' || full[i] === ','
}

function safeObjectKey(key) {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)
}

function isComponentTag(tag) {
  return /^[A-Z]/.test(tag)
}

function hashString(value) {
  let hash = 2166136261

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}

function scopeCss(css, scopeAttr) {
  if (!css.trim() || !scopeAttr) return css

  return css.replace(/([^{}@][^{}]*?)\s*{/g, (match, selector) => {
    const scoped = selector
      .split(',')
      .map((part) => scopeSelector(part.trim(), scopeAttr))
      .join(', ')

    return `${scoped} {`
  })
}

function scopeSelector(selector, scopeAttr) {
  if (!selector || selector.startsWith('@')) return selector

  return selector.replace(/:global\(([^)]+)\)/g, '$1')
    .split(/\s+/)
    .map((part, index, parts) => {
      if (index !== parts.length - 1) return part
      if (!part || part.includes(`[${scopeAttr}]`)) return part
      const pseudoIndex = part.search(/:{1,2}[A-Za-z-]/)
      if (pseudoIndex === -1) return `${part}[${scopeAttr}]`
      return `${part.slice(0, pseudoIndex)}[${scopeAttr}]${part.slice(pseudoIndex)}`
    })
    .join(' ')
}

function toComponentName(filename) {
  const base = filename.split(/[\\/]/).pop()?.replace(/\.blck$/, '') ?? 'Component'
  return base
    .replace(/(^|[-_\s]+)([a-zA-Z0-9])/g, (_, __, char) => char.toUpperCase())
    .replace(/[^A-Za-z0-9_$]/g, '') || 'Component'
}

function indent(code, spaces) {
  if (!code) return ''

  const pad = ' '.repeat(spaces)
  return code.split('\n').map((line) => line ? pad + line : line).join('\n')
}
