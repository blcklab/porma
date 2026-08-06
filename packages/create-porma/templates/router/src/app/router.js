import { createRouter } from '@blcklab/porma-router'
import HomePage from '../pages/Home.blck'
import AboutPage from '../pages/About.blck'

export const router = createRouter({
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/about', name: 'about', component: AboutPage }
  ]
})
