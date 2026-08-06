import test from 'node:test'
import assert from 'node:assert/strict'
import { signal, computed, effect, batch, untrack } from '../src/reactivity/index.js'

test('signal reads, writes, and updates', () => {
  const count = signal(0)

  assert.equal(count.value, 0)

  count.value = 1
  assert.equal(count.value, 1)

  count.update((n) => n + 1)
  assert.equal(count.value, 2)
})

test('effect runs immediately and reruns on dependency change', () => {
  const count = signal(0)
  const seen = []

  effect(() => {
    seen.push(count.value)
  })

  count.value = 1
  count.value = 2

  assert.deepEqual(seen, [0, 1, 2])
})

test('effect tracks only the active branch after rerun', () => {
  const useName = signal(true)
  const name = signal('Avelino')
  const age = signal(25)
  const seen = []

  effect(() => {
    seen.push(useName.value ? name.value : age.value)
  })

  useName.value = false
  name.value = 'Billy'
  age.value = 26

  assert.deepEqual(seen, ['Avelino', 25, 26])
})

test('computed is lazy and cached', () => {
  const count = signal(1)
  let runs = 0

  const doubled = computed(() => {
    runs++
    return count.value * 2
  })

  assert.equal(runs, 0)
  assert.equal(doubled.value, 2)
  assert.equal(doubled.value, 2)
  assert.equal(runs, 1)

  count.value = 2

  assert.equal(runs, 1)
  assert.equal(doubled.value, 4)
  assert.equal(runs, 2)
})

test('batch reruns effects only once after grouped writes', () => {
  const first = signal('A')
  const last = signal('B')
  const seen = []

  effect(() => {
    seen.push(`${first.value}${last.value}`)
  })

  batch(() => {
    first.value = 'C'
    last.value = 'D'
  })

  assert.deepEqual(seen, ['AB', 'CD'])
})

test('untrack reads without subscribing', () => {
  const count = signal(0)
  let runs = 0

  effect(() => {
    untrack(() => count.value)
    runs++
  })

  count.value = 1

  assert.equal(runs, 1)
})
