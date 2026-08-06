# Components

Porma components use the `.blck` file extension.

```html
<logic>
const title = 'Welcome'
</logic>

<view>
  <h1>{title}</h1>
</view>

<style scoped>
h1 {
  font-weight: 700;
}
</style>
```

## Props

Use `defineProps()` to receive values from a parent component.

```html
<logic>
const props = defineProps({
  label: { default: 'Button' },
  disabled: { default: false }
})
</logic>

<view>
  <button disabled={props.disabled}>{props.label}</button>
</view>
```

```html
<ActionButton label="Save" disabled={false} />
```

## Events

Use `on.event` for native DOM events.

```html
<button on.click={save}>Save</button>
<form on.submit.prevent={submit}>...</form>
```

Supported modifiers include `prevent`, `stop`, `self`, and `once`.

## Conditions

```html
<p if={ready}>Ready</p>
<p show={visible}>This stays in the DOM.</p>
```

## Lists

```html
<ul>
  <li loop="item in items" key={item.id}>
    {item.name}
  </li>
</ul>
```

An index can also be included:

```html
<li loop="(item, index) in items" key={item.id}>
  {index + 1}. {item.name}
</li>
```

## Classes and styles

```html
<div class={['card', { active: isActive }]}>
  Content
</div>

<div style={{ opacity: enabled ? 1 : 0.5 }}>
  Content
</div>
```

## Shared parent state

Child components can read bindings from a parent component. Use `shared()` for state that children may update.

```html
<logic>
import { signal, shared } from '@blcklab/porma'
import CounterButton from './CounterButton.blck'

const count = shared(signal(0))
</logic>

<view>
  <CounterButton />
  <p>{count}</p>
</view>
```

Inside `CounterButton.blck`:

```html
<logic>
const inherited = defineInherits()

function increment() {
  inherited.count.value++
}
</logic>

<view>
  <button on.click={increment}>Increment</button>
</view>
```
