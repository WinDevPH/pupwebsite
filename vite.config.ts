import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { cpSync, createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'
import { defineConfig } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))
const pdfDecoderDir = resolve(root, 'node_modules/pdfjs-dist/wasm')
const pdfDecoderNames = ['jbig2_nowasm_fallback.js', 'openjpeg_nowasm_fallback.js']

function pdfDecoderMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const name = req.url?.split('?')[0]?.replace(/^\/pdfjs\//, '') ?? ''
    if (!pdfDecoderNames.includes(name)) {
      next()
      return
    }
    const file = resolve(pdfDecoderDir, name)
    if (!file.startsWith(pdfDecoderDir) || !existsSync(file) || !statSync(file).isFile()) {
      next()
      return
    }
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
    createReadStream(file).pipe(res)
  }
}

function pdfjsAssets(): Plugin {
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(pdfDecoderMiddleware())
  }
  return {
    name: 'pdfjs-assets',
    configureServer: attach,
    configurePreviewServer: attach,
    closeBundle() {
      const to = resolve(root, 'dist/pdfjs')
      mkdirSync(to, { recursive: true })
      for (const name of pdfDecoderNames) {
        cpSync(resolve(pdfDecoderDir, name), resolve(to, name))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pdfjsAssets()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/pup/api'),
      },
    },
  },
})
