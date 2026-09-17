const forbidden = /\/(?:mockData|demoData|PublicDataDemo|publicDemo)\.[cm]?[jt]sx?(?:\?|$)/

export function assertNoMockRuntime(bundle) {
  for (const output of Object.values(bundle)) {
    if (output.type !== 'chunk') continue
    for (const [id, module] of Object.entries(output.modules)) {
      if (module.renderedLength > 0 && forbidden.test(id.replaceAll('\\', '/'))) {
        throw new Error(`Mock or demo data entered the application bundle: ${id.split('/').pop()}`)
      }
    }
  }
}

export function noMockRuntimePlugin() {
  return {
    name: 'no-mock-business-data',
    apply: 'build',
    generateBundle(_options, bundle) {
      assertNoMockRuntime(bundle)
    }
  }
}
