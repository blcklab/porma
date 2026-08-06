# Porma

Porma is a lightweight frontend framework for building interfaces with `.blck` components, fine-grained reactivity, and direct DOM updates.

- Simple single-file components
- Built-in signals and computed values
- Scoped component styles
- Optional router
- TypeScript support
- No runtime dependencies

## Create an app

```bash
npm create porma@latest my-app
cd my-app
npm install
npm run dev
```

Available templates:

```bash
npm create porma@latest my-app -- --template basic
npm create porma@latest my-app -- --template typescript
npm create porma@latest my-app -- --template router
```

## Your first component

```html
<logic>
import { signal } from '@blcklab/porma'

const count = signal(0)
</logic>

<view>
  <button on.click={() => count.value++}>
    Count: {count}
  </button>
</view>

<style scoped>
button {
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
}
</style>
```

Mount the component from `src/main.js`:

```js
import { mount } from '@blcklab/porma/dom'
import App from './App.blck'

mount(App, '#app')
```

## Documentation

- [Getting started](docs/getting-started.md)
- [Components](docs/components.md)
- [Reactivity](docs/reactivity.md)
- [Router](docs/router.md)
- [TypeScript](docs/typescript.md)
- [VS Code extension](docs/vscode-extension.md)

## Packages

| Package | Use |
| --- | --- |
| `@blcklab/porma` | Core framework |
| `@blcklab/porma-vite` | Vite support for `.blck` files |
| `@blcklab/porma-router` | Optional client-side router |
| `create-porma` | Project starter |

## License

[MIT](LICENSE)
