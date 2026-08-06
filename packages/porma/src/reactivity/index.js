let activeEffect = null
const effectStack = []
let batchDepth = 0
const pendingEffects = new Set()
let signalMutationObserver = null

function notifySignalMutation(signalObject, nextValue, previousValue) {
  if (typeof signalMutationObserver !== 'function') return
  signalMutationObserver(signalObject, nextValue, previousValue)
}

class ReactiveEffect {
  constructor(fn, scheduler = null) {
    this.fn = fn
    this.scheduler = scheduler
    this.deps = new Set()
    this.cleanups = []
    this.active = true
    this.running = false
  }

  run() {
    if (!this.active) {
      return this.fn(() => {})
    }

    if (this.running) return

    cleanupEffect(this)

    try {
      this.running = true
      effectStack.push(this)
      activeEffect = this

      return this.fn((cleanup) => {
        if (typeof cleanup === 'function') {
          this.cleanups.push(cleanup)
        }
      })
    } finally {
      effectStack.pop()
      activeEffect = effectStack[effectStack.length - 1] ?? null
      this.running = false
    }
  }

  schedule() {
    if (!this.active) return

    if (this.scheduler) {
      this.scheduler()
      return
    }

    if (batchDepth > 0) {
      pendingEffects.add(this)
      return
    }

    this.run()
  }

  stop() {
    if (!this.active) return

    this.active = false
    cleanupEffect(this)
  }
}

function cleanupEffect(effect) {
  for (const cleanup of effect.cleanups.splice(0)) {
    cleanup()
  }

  for (const dep of effect.deps) {
    dep.delete(effect)
  }

  effect.deps.clear()
}

function track(dep) {
  if (!activeEffect || !activeEffect.active) return

  dep.add(activeEffect)
  activeEffect.deps.add(dep)
}

function trigger(dep) {
  const effects = [...dep]

  for (const effect of effects) {
    effect.schedule()
  }
}

function flushBatch() {
  if (batchDepth > 0) return

  const effects = [...pendingEffects]
  pendingEffects.clear()

  for (const effect of effects) {
    effect.run()
  }
}

export function signal(initialValue) {
  let value = initialValue
  const dep = new Set()

  const signalObject = {
    get value() {
      track(dep)
      return value
    },

    set value(nextValue) {
      if (Object.is(value, nextValue)) return

      const previousValue = value
      notifySignalMutation(signalObject, nextValue, previousValue)
      value = nextValue
      trigger(dep)
    },

    peek() {
      return value
    },

    update(fn) {
      this.value = fn(value)
    }
  }

  return signalObject
}

export function computed(getter) {
  let value
  let dirty = true
  const dep = new Set()

  const runner = new ReactiveEffect(
    () => getter(),
    () => {
      if (!dirty) {
        dirty = true
        trigger(dep)
      }
    }
  )

  function read(shouldTrack) {
    if (shouldTrack) {
      track(dep)
    }

    if (dirty) {
      value = runner.run()
      dirty = false
    }

    return value
  }

  return {
    get value() {
      return read(true)
    },

    peek() {
      return read(false)
    }
  }
}

export function effect(fn) {
  const runner = new ReactiveEffect(fn)

  runner.run()

  return () => {
    runner.stop()
  }
}

export function batch(fn) {
  batchDepth++

  try {
    return fn()
  } finally {
    batchDepth--
    flushBatch()
  }
}

export function untrack(fn) {
  const previous = activeEffect
  activeEffect = null

  try {
    return fn()
  } finally {
    activeEffect = previous
  }
}

export function isSignal(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'value' in value &&
    typeof value.peek === 'function'
  )
}

export function read(value) {
  return isSignal(value) ? value.value : value
}

export function setSignalMutationObserver(observer) {
  signalMutationObserver = typeof observer === 'function' ? observer : null
}
