import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig, PluginOption } from 'vite'

import sparkPlugin from '@github/spark/spark-vite-plugin'
import createIconImportProxy from '@github/spark/vitePhosphorIconProxyPlugin'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const appRoot = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  root: appRoot,
  plugins: [
    react(),
    tailwindcss(),
    // DO NOT REMOVE
    createIconImportProxy() as PluginOption,
    sparkPlugin({ port: 5173 }) as PluginOption
  ],
  resolve: {
    alias: {
      '@': resolve(appRoot, 'src')
    }
  },
  build: {
    outDir: resolve(appRoot, '../../dist'),
    emptyOutDir: true
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts: true
  }
})
