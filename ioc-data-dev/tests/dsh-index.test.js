import assert from 'node:assert/strict'
import test from 'node:test'

import { apply } from '../dsh/index.js'

test('defers optional API registration until webServer is injected', () => {
  const injections = []
  const ctx = {
    tools: {
      register() {},
    },
    effect() {},
    inject(services, callback) {
      injections.push({ services, callback })
    },
    get webServer() {
      throw new Error('cannot get property "webServer" without inject')
    },
  }

  assert.doesNotThrow(() =>
    apply(ctx, {
      guardsEnabled: false,
      skillsEnabled: false,
    }),
  )
  assert.deepEqual(
    injections.map(({ services }) => services),
    [['webServer']],
  )
})

test('keeps the API route registered until the injected scope is disposed', () => {
  let registeredRoute
  const cleanups = []
  const webCtx = {
    webServer: {
      register(route) {
        registeredRoute = route
        return () => {
          registeredRoute = undefined
        }
      },
    },
    effect(setup) {
      cleanups.push(setup())
    },
  }
  const ctx = {
    tools: {
      register() {},
    },
    inject(services, callback) {
      assert.deepEqual(services, ['webServer'])
      callback(webCtx)
    },
  }

  apply(ctx, {
    guardsEnabled: false,
    skillsEnabled: false,
  })

  assert.deepEqual(
    { kind: registeredRoute?.kind, path: registeredRoute?.path },
    { kind: 'prefix', path: '/ioc-api' },
  )
  assert.equal(cleanups.length, 1)
  assert.equal(typeof cleanups[0], 'function')

  cleanups[0]()
  assert.equal(registeredRoute, undefined)
})
