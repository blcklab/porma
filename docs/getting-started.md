# Getting started

## Create a project

```bash
npm create porma@latest my-app
cd my-app
npm install
npm run dev
```

Choose a starter with `--template`:

```bash
npm create porma@latest my-app -- --template basic
npm create porma@latest my-app -- --template typescript
npm create porma@latest my-app -- --template router
```

## Main files

A generated app includes:

```txt
src/
  main.js
  App.blck
  components/
  layouts/
  pages/
  styles/
  lib/
```

`src/main.js` starts the app:

```js
import { mount } from '@blcklab/porma/dom'
import App from './App.blck'
import './styles/global.css'

mount(App, '#app')
```

`src/App.blck` is the root component:

```html
<logic>
import { signal } from '@blcklab/porma'

const message = signal('Hello, Porma!')
</logic>

<view>
  <h1>{message}</h1>
</view>
```

## Build for production

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Manual setup

Install Porma and Vite:

```bash
npm install @blcklab/porma
npm install -D @blcklab/porma-vite vite
```

Create `vite.config.js`:

```js
import porma from '@blcklab/porma-vite'

export default {
  plugins: [porma()]
}
```
