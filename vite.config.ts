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

function legacyUploadsRewrite(): Plugin {
  const picture = '([^?]+\\.(?:jpe?g|png|webp|gif|svg))'
  const rules: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [
      new RegExp(`^/(announcements|calendar|projects|council|gallery|hero|users|shop)/uploads/([^?]+)`),
      (match) => `/uploads/${match[1]}/${match[2]}`,
    ],
    [/^\/hero\/seed\/([^?]+)/, (match) => `/uploads/hero/${match[1]}`],
    [/^\/gallery\/seed\/([^?]+)/, (match) => `/uploads/gallery/${match[1]}`],
    [/^\/council\/people\/([^?]+)/, (match) => `/uploads/council/${match[1]}`],
    [/^\/calendar\/defaults\/([^?]+)/, (match) => `/uploads/calendar/${match[1]}`],
    [/^\/org-logos\/([^?]+)/, (match) => `/uploads/org-logos/${match[1]}`],
    [new RegExp(`^/announcements/${picture}`, 'i'), (match) => `/uploads/announcements/${match[1]}`],
    [new RegExp(`^/calendar/${picture}`, 'i'), (match) => `/uploads/calendar/${match[1]}`],
    [new RegExp(`^/projects/${picture}`, 'i'), (match) => `/uploads/projects/${match[1]}`],
    [new RegExp(`^/shop/${picture}`, 'i'), (match) => `/uploads/shop/${match[1]}`],
    [new RegExp(`^/hero/${picture}`, 'i'), (match) => `/uploads/hero/${match[1]}`],
    [new RegExp(`^/gallery/${picture}`, 'i'), (match) => `/uploads/gallery/${match[1]}`],
    [new RegExp(`^/council/${picture}`, 'i'), (match) => `/uploads/council/${match[1]}`],
  ]
  const rewrite = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((req, _res, next) => {
      const path = req.url?.split('?')[0] ?? ''
      for (const [pattern, to] of rules) {
        const match = path.match(pattern)
        if (!match) {
          continue
        }
        const query = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
        req.url = `${to(match)}${query}`
        break
      }
      next()
    })
  }
  return {
    name: 'legacy-uploads-rewrite',
    configureServer: rewrite,
    configurePreviewServer: rewrite,
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
  plugins: [react(), tailwindcss(), pdfjsAssets(), legacyUploadsRewrite()],
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
