import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertNoMockRuntime } from '../no-mock-runtime.mjs'

const bundle = (id, renderedLength = 20) => ({
  app: { type: 'chunk', modules: { [id]: { renderedLength } } }
})

test('mock and demo implementations cannot be shipped in any application chunk', () => {
  for (const name of ['mockData.ts', 'demoData.ts', 'PublicDataDemo.tsx', 'publicDemo.ts']) {
    assert.throws(
      () => assertNoMockRuntime(bundle(`/app/src/${name}`)),
      /entered the application bundle/
    )
  }
})

test('real API modules and fully eliminated fixture code are permitted', () => {
  assertNoMockRuntime(bundle('/app/src/api/prospects.ts'))
  assertNoMockRuntime(bundle('/app/src/mockData.ts', 0))
})

test('receipt-bound public data modules require the explicit Pages build mode', () => {
  assert.doesNotThrow(() =>
    assertNoMockRuntime(bundle('/app/src/PublicDataDemo.tsx'), { allowPublicDataDemo: true })
  )
  assert.doesNotThrow(() =>
    assertNoMockRuntime(bundle('/app/src/publicDemo.ts'), { allowPublicDataDemo: true })
  )
  assert.throws(
    () => assertNoMockRuntime(bundle('/app/src/mockData.ts'), { allowPublicDataDemo: true }),
    /entered the application bundle/
  )
})
