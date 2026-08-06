import test from 'node:test'
import assert from 'node:assert/strict'
import { signal } from '../src/reactivity/index.js'
import { createScope, expose } from '../src/scope/index.js'
import { createComponent, defineProps, instantiateComponent, markMounted, unmountComponent, onMount, onUnmount, mountComponent } from '../src/runtime/index.js'

test('defineProps resolves explicit prop over inherited scope and default', () => {
  const parent = createScope(null, { owner: 'Parent' })
  expose(parent, { label: signal('Inherited') })

  const Button = createComponent((scope) => {
    const props = defineProps({
      label: { default: 'Submit' }
    })

    return () => props.label
  }, { name: 'Button' })

  const explicit = instantiateComponent(Button, { label: 'Save' }, parent)
  const inherited = instantiateComponent(Button, {}, parent)

  assert.equal(explicit.render(), 'Save')
  assert.equal(inherited.render(), parent.label)
})

test('defineProps uses default when explicit and inherited values are missing', () => {
  const Button = createComponent(() => {
    const props = defineProps({
      label: { default: 'Submit' }
    })

    return () => props.label
  }, { name: 'Button' })

  const instance = instantiateComponent(Button, {}, null)

  assert.equal(instance.render(), 'Submit')
})


test('component unmount is idempotent and runs mount cleanup once', () => {
  let mounted = 0
  let mountCleanup = 0
  let unmounted = 0

  const Panel = createComponent(() => {
    onMount(() => {
      mounted++
      return () => {
        mountCleanup++
      }
    })

    onUnmount(() => {
      unmounted++
    })

    return () => 'node'
  }, { name: 'Panel' })

  const instance = instantiateComponent(Panel, {}, null)
  instance.render()
  markMounted(instance)
  unmountComponent(instance)
  unmountComponent(instance)

  assert.equal(mounted, 1)
  assert.equal(mountCleanup, 1)
  assert.equal(unmounted, 1)
})

test('unmount removes child instances from their parent list', () => {
  const Parent = createComponent(() => () => 'parent', { name: 'Parent' })
  const Child = createComponent(() => () => 'child', { name: 'Child' })

  const parent = instantiateComponent(Parent, {}, null)
  const child = instantiateComponent(Child, {}, parent.scope, parent)

  assert.equal(parent.children.length, 1)
  unmountComponent(child)
  assert.equal(parent.children.length, 0)
})

test('mount installs plugins on the root scope and cleans them up once', () => {
  const target = {
    textContent: 'old',
    child: null,
    appendChild(node) {
      this.child = node
      node.parentNode = this
    },
    removeChild(node) {
      if (this.child === node) this.child = null
      node.parentNode = null
    }
  }
  const node = { parentNode: null }
  let cleanups = 0

  const App = createComponent(() => () => node, { name: 'PluginApp' })
  const handle = mountComponent(App, target, {
    plugins: [
      (scope) => {
        scope.fromFunction = true
        return () => cleanups++
      },
      {
        install(scope) {
          scope.fromObject = true
        },
        start(scope, instance) {
          scope.started = instance.name
          return () => cleanups++
        }
      }
    ]
  })

  assert.equal(handle.rootScope.fromFunction, true)
  assert.equal(handle.rootScope.fromObject, true)
  assert.equal(handle.scope.started, 'PluginApp')

  handle.unmount()
  handle.unmount()

  assert.equal(cleanups, 2)
  assert.equal(target.child, null)
})
