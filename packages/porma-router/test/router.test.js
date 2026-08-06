import test from 'node:test'
import assert from 'node:assert/strict'
import { createRouter, createRouteScope } from '../src/index.js'

test('router resolves static and dynamic routes without entering Porma core', () => {
  const User = { __pormaComponent: true }
  const router = createRouter({
    initialPath: '/',
    routes: [
      { path: '/', name: 'home' },
      { path: '/users/:id', name: 'user', component: User, meta: { auth: true } }
    ]
  })

  const route = router.resolve('/users/42?tab=posts#bio')

  assert.equal(route.path, '/users/42')
  assert.equal(route.fullPath, '/users/42?tab=posts#bio')
  assert.equal(route.params.id, '42')
  assert.equal(route.query.tab, 'posts')
  assert.equal(route.hash, 'bio')
  assert.equal(route.name, 'user')
  assert.equal(route.component, User)
  assert.deepEqual(route.meta, { auth: true })
})

test('router push updates shared route scope signal', () => {
  const router = createRouter({
    initialPath: '/',
    routes: [
      { path: '/', name: 'home' },
      { path: '/about', name: 'about' }
    ]
  })

  const scope = createRouteScope(router)

  assert.equal(scope.route.value.path, '/')
  router.push('/about')
  assert.equal(scope.route.value.path, '/about')
  assert.equal(scope.router, router)
})

test('router guards can cancel navigation and after hooks observe successful navigation', () => {
  const router = createRouter({
    initialPath: '/',
    routes: [
      { path: '/', name: 'home' },
      { path: '/admin', name: 'admin' },
      { path: '/about', name: 'about' }
    ]
  })
  const after = []

  router.beforeEach((to) => {
    if (to.path === '/admin') return false
  })
  router.afterEach((to, from) => {
    after.push(`${from.path}->${to.path}`)
  })

  assert.equal(router.push('/admin'), false)
  assert.equal(router.currentRoute.value.path, '/')

  const about = router.push('/about')
  assert.equal(about.path, '/about')
  assert.deepEqual(after, ['/->/about'])
})

test('router can add and remove routes and compute active hrefs', () => {
  const router = createRouter({
    mode: 'hash',
    initialPath: '/',
    routes: [{ path: '/', name: 'home' }]
  })

  const remove = router.addRoute({ path: '/docs/:slug', name: 'docs' })
  router.push('/docs/intro')

  assert.equal(router.currentRoute.value.name, 'docs')
  assert.equal(router.currentRoute.value.params.slug, 'intro')
  assert.equal(router.isActive('/docs/intro'), true)
  assert.equal(router.isActive('/docs', { exact: false }), true)
  assert.equal(router.createHref('/docs/intro?tab=api'), '#/docs/intro?tab=api')

  assert.equal(remove(), true)
  assert.equal(router.resolve('/docs/intro').matched, null)
})
