import { mount } from '@blcklab/porma/dom'
import { createRouter, createRouteScope } from '@blcklab/porma-router'
import App from './App.blck'

const router = createRouter({
  routes: [
    { path: '/', name: 'home' },
    { path: '/users/:id', name: 'user' }
  ]
})

mount(App, '#app', {
  dev: true,
  scope: createRouteScope(router)
})
