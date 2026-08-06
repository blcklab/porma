import { mount } from '@blcklab/porma/dom'
import App from './App.blck'
import { router } from './app/router.js'
import './styles/global.css'

mount(App, '#app', {
  dev: true,
  plugins: [router]
})
