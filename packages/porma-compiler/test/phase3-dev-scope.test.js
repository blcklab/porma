import test from 'node:test'
import assert from 'node:assert/strict'
import { compileBlck } from '../src/index.js'

test('dev compilation emits readScope for inherited-looking identifiers', () => {
  const result = compileBlck(`
<logic>
</logic>
<view>
  <p>{count}</p>
</view>
`, { filename: 'CounterText.blck', dev: true })

  assert.ok(result.code.includes('readScope'))
  assert.ok(result.meta.runtimeImports.includes('readScope'))
  assert.ok(result.meta.warnings.some((warning) => warning.includes('count') && warning.includes('inherited scope')))
})
