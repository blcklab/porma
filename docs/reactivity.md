# Reactivity

Import reactive utilities from `@blcklab/porma`.

## Signals

```js
import { signal } from '@blcklab/porma'

const count = signal(0)

count.value++
count.value = 10
```

Inside a `.blck` view, signals are displayed automatically:

```html
<p>{count}</p>
```

## Computed values

```js
import { computed, signal } from '@blcklab/porma'

const price = signal(20)
const quantity = signal(2)
const total = computed(() => price.value * quantity.value)
```

```html
<p>Total: {total}</p>
```

## Effects

```js
import { effect, signal } from '@blcklab/porma'

const query = signal('')

const stop = effect((onCleanup) => {
  const value = query.value
  const timer = setTimeout(() => search(value), 300)

  onCleanup(() => clearTimeout(timer))
})

stop()
```

## Batch updates

```js
import { batch } from '@blcklab/porma'

batch(() => {
  firstName.value = 'Avelino'
  lastName.value = 'Dela Cruz'
})
```
