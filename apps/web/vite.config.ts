import { noMockRuntimePlugin } from '../../scripts/no-mock-runtime.mjs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig, PluginOption } from 'vite'

import sparkPlugin from '@github/spark/spark-vite-plugin'
import createIconImportProxy from '@github/spark/vitePhosphorIconProxyPlugin'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const appRoot = dirname(fileURLToPath(import.meta.url))
const sparkEnabled = process.env.VITE_ENABLE_SPARK === 'true'
const tenantDashboard = process.env.VITE_DEPLOYMENT_SURFACE === 'tenant-dashboard'

// https://vite.dev/config/
export default defineConfig({
  root: appRoot,
  plugins: [
    noMockRuntimePlugin() as PluginOption,
    react(),
    tailwindcss(),
    // DO NOT REMOVE
    createIconImportProxy() as PluginOption,
    ...(sparkEnabled ? [sparkPlugin({ port: 5173 }) as PluginOption] : [])
  ],
  resolve: {
    alias: [
      { find: '@', replacement: resolve(appRoot, 'src') },
      ...(tenantDashboard
        ? [
            {
              find: /^\.\/App\.tsx$/,
              replacement: resolve(appRoot, 'src/TenantDashboardApp.tsx')
            }
          ]
        : [])
    ]
  },
  build: {
    outDir: resolve(appRoot, '../../dist'),
    emptyOutDir: true
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    fs: {
      allow: [appRoot, resolve(appRoot, '../../packages'), resolve(appRoot, '../../node_modules')]
    }
  }
})
