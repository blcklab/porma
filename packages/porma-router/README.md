# @blcklab/porma-router

Optional client-side router for Porma apps.

```bash
npm install @blcklab/porma-router
```

```js
import { mount } from '@blcklab/porma/dom'
import { createRouter } from '@blcklab/porma-router'
import App from './App.blck'
import Home from './pages/Home.blck'
import About from './pages/About.blck'

const router = createRouter({
  routes: [
    { path: '/', component: Home },
    { path: '/about', component: About }
  ]
})

mount(App, '#app', {
  plugins: [router]
})
```
