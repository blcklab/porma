import test from 'node:test'
import assert from 'node:assert/strict'
import { compileBlck, parseBlocks } from '../src/index.js'

test('parseBlocks extracts logic view and style', () => {
  const blocks = parseBlocks(`
<logic>
const count = signal(0)
</logic>

<view>
  <button>Count: {count}</button>
</view>

<style scoped>
button { color: red; }
</style>
`)

  assert.equal(blocks.logic, 'const count = signal(0)')
  assert.equal(blocks.view, '<button>Count: {count}</button>')
  assert.equal(blocks.style, 'button { color: red; }')
})

test('compileBlck emits a Porma component and only needed DOM helpers', () => {
  const result = compileBlck(`
<logic>
import { signal } from '@blcklab/porma'

const count = signal(0)
function increment() {
  count.value++
}
</logic>

<view>
  <button on.click={increment}>Count: {count}</button>
</view>
`, { filename: 'Counter.blck' })

  assert.match(result.code, /createComponent/)
  assert.match(result.code, /bindEvent/)
  assert.match(result.code, /bindText/)
  assert.match(result.code, /bindEvent\(_el0, "click", increment\)/)
  assert.match(result.code, /exposeSetup\(scope, \{ count, increment \}/)
  assert.equal(result.meta.name, 'Counter')
  assert.deepEqual(result.meta.blocks, ['logic', 'view'])
})

test('compileBlck converts unknown view identifiers to scope lookups', () => {
  const result = compileBlck(`
<view>
  <p>Count: {count}</p>
</view>
`, { filename: 'CounterText.blck' })

  assert.match(result.code, /read\(scope\.count\)/)
})

test('compileBlck supports plain Porma directives if, show, and loop', () => {
  const result = compileBlck(`
<logic>
const open = signal(true)
const items = signal([{ id: 1, name: 'Build Porma' }])
</logic>

<view>
  <ul if={open}>
    <li loop="(item, index) in items" key={item.id} show={open}>
      {index + 1}. {item.name}
    </li>
  </ul>
</view>
`, { filename: 'TodoList.blck' })

  assert.match(result.code, /bindIf/)
  assert.match(result.code, /bindList/)
  assert.match(result.code, /bindShow/)
  assert.match(result.code, /bindList\(\(\) => items, \(item, index\) =>/) 
  assert.match(result.code, /\(item, index\) => item\.id/)
  assert.match(result.code, /read\(item\.name\)/)
  assert.deepEqual(result.meta.domImports, [
    'append',
    'bindIf',
    'bindList',
    'bindShow',
    'bindText',
    'element',
    'textNode'
  ])
})

test('boolean loop remains a native HTML attribute', () => {
  const result = compileBlck(`
<view>
  <video loop></video>
</view>
`, { filename: 'Video.blck' })

  assert.doesNotMatch(result.code, /bindList/)
  assert.match(result.code, /setAttr\(_el0, "loop"/)
})

test('compileBlck supports <logic lang="ts"> without changing inherited scope runtime', () => {
  const result = compileBlck(`
<logic lang="ts">
import { signal, shared, type Signal } from '@blcklab/porma'

type Todo = { id: number; text: string }
interface Theme { name: string }

const inherited = defineInherits<{ count: Signal<number> }>()
const todos = signal<Todo[]>([{ id: 1, text: 'Build TS' }])
const count: Signal<number> = shared(signal<number>(0))

function add(todo: Todo): void {
  todos.value = [...todos.value, todo]
}
</logic>

<view>
  <section>
    <p>{count}</p>
    <p>{inherited.count}</p>
    <li loop="todo in todos" key={todo.id}>{todo.text}</li>
  </section>
</view>
`, { filename: 'TypedCounter.blck' })

  assert.equal(result.meta.logicLang, 'ts')
  assert.match(result.code, /defineInherits\(\)/)
  assert.match(result.code, /const todos = signal\(\[\{ id: 1, text: 'Build TS' \}\]\)/)
  assert.match(result.code, /const count= shared\(signal\(0\)\)/)
  assert.match(result.code, /function add\(todo\)/)
  assert.doesNotMatch(result.code, /type Todo/)
  assert.doesNotMatch(result.code, /interface Theme/)
  assert.doesNotMatch(result.code, /Signal<number>/)
  assert.match(result.code, /read\(inherited\.count\)/)
})

test('compileBlck scopes <style scoped> and injects CSS once per component', () => {
  const result = compileBlck(`
<style scoped>
.card, button:hover { color: red; }
</style>

<view>
  <section class="card">
    <button>Save</button>
  </section>
</view>
`, { filename: 'ScopedCard.blck' })

  assert.equal(result.meta.scopedStyle, true)
  assert.match(result.meta.scopeId, /^data-porma-/)
  assert.match(result.code, /injectStyle\(/)
  assert.match(result.code, new RegExp(`setAttr\\(_el0, "${result.meta.scopeId}", true\\)`))
  assert.match(result.code, new RegExp(`setAttr\\(_el1, "${result.meta.scopeId}", true\\)`))
  assert.match(result.code, new RegExp(`\\[${result.meta.scopeId}\\]`))
})

test('compileBlck uses properties for form value checked and selected', () => {
  const result = compileBlck(`
<logic>
const name = signal('Avelino')
const accepted = signal(true)
</logic>

<view>
  <form>
    <input value={name} checked={accepted} />
    <option selected>One</option>
  </form>
</view>
`, { filename: 'FormPanel.blck' })

  assert.match(result.code, /bindProperty\(_el1, "value", \(\) => name\)/)
  assert.match(result.code, /bindProperty\(_el1, "checked", \(\) => accepted\)/)
  assert.match(result.code, /setProperty\(_el2, "selected", true\)/)
  assert.doesNotMatch(result.code, /bindAttr\(_el1, "value"/)
})

test('compileBlck warns about loop without key', () => {
  const result = compileBlck(`
<logic>
const todos = signal([])
</logic>

<view>
  <li loop="todo in todos">{todo.text}</li>
</view>
`, { filename: 'TodoList.blck' })

  assert.equal(result.meta.warnings.length, 1)
  assert.match(result.meta.warnings[0], /has no key/)
})

test('compileBlck imports runtime helpers only when used', () => {
  const result = compileBlck(`
<view>
  <p>Hello</p>
</view>
`, { filename: 'StaticHello.blck' })

  assert.deepEqual(result.meta.runtimeImports, ['createComponent'])
  assert.doesNotMatch(result.code, /defineProps/)
  assert.doesNotMatch(result.code, /defineInherits/)
  assert.doesNotMatch(result.code, /read/)
})

test('compiler uses Porma scanner without Acorn and recognizes destructured setup bindings', () => {
  const result = compileBlck(`
<logic>
const { label: localLabel, nested: { name }, ...rest } = config
const [first, second] = items
</logic>

<view>
  <p>{localLabel} {name} {rest} {first} {second}</p>
</view>
`, { filename: 'ScannerBindings.blck' })

  assert.equal(result.meta.parserMode, 'porma-scanner')
  assert.match(result.code, /read\(localLabel\)/)
  assert.match(result.code, /read\(name\)/)
  assert.match(result.code, /read\(rest\)/)
  assert.match(result.code, /read\(first\)/)
  assert.match(result.code, /read\(second\)/)
  assert.doesNotMatch(result.code, /scope\.localLabel/)
  assert.doesNotMatch(result.code, /scope\.first/)
})

test('compileBlck reports malformed or duplicate blocks as warnings', () => {
  const duplicate = compileBlck(`
<view><p>One</p></view>
<view><p>Two</p></view>
`, { filename: 'Duplicate.blck' })

  assert.match(duplicate.meta.warnings.join('\n'), /duplicate <view> block/)

  const missing = compileBlck(`
<logic>
const count = signal(0)
</logic>
`, { filename: 'MissingView.blck' })

  assert.match(missing.meta.warnings.join('\n'), /missing <view> block/)
})

test('compileBlck emits dev diagnostics for inherited runtime scope lookups', () => {
  const result = compileBlck(`
<view>
  <p>{theme}</p>
</view>
`, { filename: 'InheritedTheme.blck', dev: true })

  assert.match(result.meta.warnings.join('\n'), /theme.*inherited scope/)
})

test('compileBlck supports class and style object bindings plus event modifiers', () => {
  const result = compileBlck(`
<logic>
const classes = { active: true }
const styles = { color: 'red' }
function submit(event) {}
</logic>

<view>
  <form on.submit.prevent={submit} class={classes} style={styles}></form>
</view>
`, { filename: 'FormCard.blck' })

  assert.match(result.code, /bindEvent\(_el0, "submit\.prevent", submit\)/)
  assert.match(result.code, /bindAttr\(_el0, "class", \(\) => classes\)/)
  assert.match(result.code, /bindAttr\(_el0, "style", \(\) => styles\)/)
})

test('compileBlck warns for malformed view tags and interpolation mistakes', () => {
  const badTags = compileBlck(`
<view>
  <section><p>Hello</section>
</view>
`, { filename: 'BadTags.blck' })

  const badText = compileBlck(`
<view>
  <span>{</span>
</view>
`, { filename: 'BadText.blck' })

  const badAttr = compileBlck(`
<view>
  <button class={active>Broken</button>
</view>
`, { filename: 'BadAttr.blck' })

  assert.match(badTags.meta.warnings.join('\n'), /unclosed <p> tag before <\/section>/)
  assert.match(badText.meta.warnings.join('\n'), /unclosed text interpolation/)
  assert.match(badAttr.meta.warnings.join('\n'), /unclosed opening tag in <view>/)
})

test('phase 1 diagnostics include filename and source line/column', () => {
  const result = compileBlck(`
<logic>
const broken = true
</logic>

<view>
  <section>
    <p>{broken</p>
  </section>
</view>
`, { filename: 'DiagnosticsPanel.blck' })

  const warnings = result.meta.warnings.join('\n')
  assert.match(warnings, /DiagnosticsPanel\.blck: line \d+, column \d+:/)
  assert.match(warnings, /unclosed text interpolation/)
})

test('phase 1 invalid loop expressions warn instead of crashing the compiler', () => {
  const result = compileBlck(`
<logic>
const items = signal([])
</logic>

<view>
  <li loop="item of items">{item.name}</li>
</view>
`, { filename: 'InvalidLoop.blck' })

  assert.match(result.meta.warnings.join('\n'), /Invalid loop expression/)
  assert.match(result.code, /fragment\(\)/)
})

test('phase 1 unknown component tags resolve through inherited scope instead of crashing at runtime', () => {
  const result = compileBlck(`
<view>
  <InheritedCard title="Hello" />
</view>
`, { filename: 'UsesInheritedCard.blck', dev: true })

  assert.match(result.code, /mountChild\(readScope\(scope, \"InheritedCard\"/)
  assert.match(result.meta.warnings.join('\n'), /InheritedCard.*inherited scope/)
})

test('phase 1 attribute diagnostics catch duplicates and invalid view expressions', () => {
  const result = compileBlck(`
<view>
  <button class="one" class="two" title={const bad = true}>Save</button>
</view>
`, { filename: 'BadAttrs.blck' })

  const warnings = result.meta.warnings.join('\n')
  assert.match(warnings, /duplicate attribute "class"/)
  assert.match(warnings, /view expressions cannot contain declarations or statements/)
})

test('phase 2 compiles common form and boolean attributes as DOM properties', () => {
  const result = compileBlck(`
<logic>
const saving = signal(false)
const readonly = signal(true)
const selected = signal(false)
</logic>

<view>
  <form>
    <input disabled={saving} readonly={readonly} required />
    <select multiple>
      <option selected={selected}>One</option>
    </select>
  </form>
</view>
`, { filename: 'FormPhase2.blck' })

  assert.match(result.code, /bindProperty\(_el1, "disabled", \(\) => saving\)/)
  assert.match(result.code, /bindProperty\(_el1, "readonly", \(\) => readonly\)/)
  assert.match(result.code, /setProperty\(_el1, "required", true\)/)
  assert.match(result.code, /setProperty\(_el2, "multiple", true\)/)
  assert.match(result.code, /bindProperty\(_el3, "selected", \(\) => selected\)/)
  assert.doesNotMatch(result.code, /bindAttr\(_el1, "disabled"/)
})

test('phase 4 TypeScript eraser handles props inherits annotations and assertions without runtime dependency', () => {
  const result = compileBlck(`
<logic lang="ts">
import { signal, computed, type Signal } from '@blcklab/porma'
import type { RouteLocation } from '@blcklab/porma-router'

interface AppScope { count: Signal<number>; theme?: Signal<string> }
type Todo<T = string> = { id: number; text?: T }
type Loader<T> = () => Promise<T>

const inherited = defineInherits<AppScope>()
const props = defineProps<{ label?: string; onClick?: () => void }>({ label: { default: 'Save' } })
const { label }: { label?: string } = props
const todos: Signal<Todo[]> = signal<Todo[]>([])
const total = computed<number>(() => todos.value.length)
const seed = { id: 1, text: 'A' } satisfies Todo
const labelText = (props.label ?? 'Save') as string
function identity<T>(value: T): T { return value }
function add(todo: Todo, index?: number): void { todos.value = [...todos.value, todo] }
const mapTodo = (todo: Todo): string => todo.text ?? ''
const copy = identity<Todo>(seed)
const safe = props.label!
</logic>

<view>
  <section>
    <p>{label}</p>
    <p>{total}</p>
    <p>{inherited.count}</p>
    <button on.click={() => add(copy)}>{mapTodo(copy)}</button>
  </section>
</view>
`, { filename: 'PhaseFourTyped.blck' })

  assert.equal(result.meta.logicLang, 'ts')
  assert.match(result.code, /import \{ signal, computed \} from '@blcklab\/porma'/)
  assert.match(result.code, /const inherited = defineInherits\(\)/)
  assert.match(result.code, /const props = defineProps\(\{ label: \{ default: 'Save' \} \}\)/)
  assert.match(result.code, /const \{ label \}\s*= props/)
  assert.match(result.code, /const todos\s*= signal\(\[\]\)/)
  assert.match(result.code, /const total = computed\(\(\) => todos\.value\.length\)/)
  assert.match(result.code, /function identity\(value\)\{ return value \}/)
  assert.match(result.code, /function add\(todo, index\)\{ todos\.value = \[\.\.\.todos\.value, todo\] \}/)
  assert.match(result.code, /const mapTodo = \(todo\) => todo\.text \?\? ''/)
  assert.match(result.code, /const copy = identity\(seed\)/)
  assert.match(result.code, /const safe = props\.label/)
  assert.doesNotMatch(result.code, /interface AppScope/)
  assert.doesNotMatch(result.code, /type Todo/)
  assert.doesNotMatch(result.code, /RouteLocation/)
  assert.doesNotMatch(result.code, /satisfies/)
  assert.doesNotMatch(result.code, /as string/)
  assert.doesNotMatch(result.code, /Signal<number>/)
  assert.match(result.code, /read\(inherited\.count\)/)
})

test('phase 4 TypeScript declarations expose stable Porma helper names', async () => {
  const fs = await import('node:fs/promises')
  const runtimeDeclarations = await fs.readFile(new URL('../../porma/src/runtime/index.d.ts', import.meta.url), 'utf8')
  const reactivityDeclarations = await fs.readFile(new URL('../../porma/src/reactivity/index.d.ts', import.meta.url), 'utf8')

  assert.match(runtimeDeclarations, /defineProps<TProps extends object/)
  assert.match(runtimeDeclarations, /defineInherits<TScope extends object/)
  assert.match(reactivityDeclarations, /interface Signal<T>/)
})
