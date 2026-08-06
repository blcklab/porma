# TypeScript

Use `<logic lang="ts">` inside a `.blck` component.

```html
<logic lang="ts">
import { signal, type Signal } from '@blcklab/porma'

const count = signal<number>(0)

const inherited = defineInherits<{
  theme: Signal<string>
}>()

function increment(): void {
  count.value++
}
</logic>

<view>
  <p>{count}</p>
  <p>{inherited.theme}</p>
  <button on.click={increment}>Increment</button>
</view>
```

Type props with `defineProps<T>()`:

```html
<logic lang="ts">
const props = defineProps<{
  label?: string
  onClick?: () => void
}>({
  label: { default: 'Button' },
  onClick: { default: null }
})
</logic>
```

For complex types, place declarations in a `.ts` or `.d.ts` file and import them into the component.
