const mockRuntime = /\/(?:mockData|demoData)\.[cm]?[jt]sx?(?:\?|$)/
const publicDataDemoRuntime = /\/(?:PublicDataDemo|publicDemo)\.[cm]?[jt]sx?(?:\?|$)/

export function assertNoMockRuntime(bundle, { allowPublicDataDemo = false } = {}) {
  for (const output of Object.values(bundle)) {
    if (output.type !== 'chunk') continue
    for (const [id, module] of Object.entries(output.modules)) {
      const normalizedId = id.replaceAll('\\', '/')
      const forbidden =
        mockRuntime.test(normalizedId) ||
        (!allowPublicDataDemo && publicDataDemoRuntime.test(normalizedId))
      if (module.renderedLength > 0 && forbidden) {
        throw new Error(`Mock or demo data entered the application bundle: ${id.split('/').pop()}`)
      }
    }
  }
}

export function noMockRuntimePlugin(options = {}) {
  return {
    name: 'no-mock-business-data',
    apply: 'build',
    generateBundle(_options, bundle) {
      assertNoMockRuntime(bundle, options)
    }
  }
}
