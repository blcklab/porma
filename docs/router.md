# Router

Install the optional router:

```bash
npm install @blcklab/porma-router
```

## Create routes

```js
import { createRouter } from '@blcklab/porma-router'
import Home from '../pages/Home.blck'
import About from '../pages/About.blck'

export const router = createRouter({
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/about', name: 'about', component: About }
  ]
})
```

## Install the router

```js
import { mount } from '@blcklab/porma/dom'
import App from './App.blck'
import { router } from './app/router.js'

mount(App, '#app', {
  plugins: [router]
})
```

## Add navigation

```html
<logic>
import { RouterLink, RouterView } from '@blcklab/porma-router'
</logic>

<view>
  <nav>
    <RouterLink to="/" label="Home" />
    <RouterLink to="/about" label="About" />
  </nav>

  <RouterView />
</view>
```

## Navigate from code

```js
router.push('/about')
router.replace('/')
```

Use hash mode when server fallback routing is unavailable:

```js
const router = createRouter({
  mode: 'hash',
  routes
})
```
