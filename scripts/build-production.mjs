import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const release = resolve(root, 'release')

if (!existsSync(dist)) {
  console.error('Missing dist/. Run vite build first.')
  process.exit(1)
}

rmSync(release, { recursive: true, force: true })
mkdirSync(release, { recursive: true })

cpSync(dist, release, { recursive: true })
cpSync(resolve(root, 'api'), resolve(release, 'api'), { recursive: true })

const envProduction = resolve(root, '.env.production')
if (!existsSync(envProduction)) {
  console.error('Missing .env.production')
  process.exit(1)
}
copyFileSync(envProduction, resolve(release, '.env.production'))
copyFileSync(envProduction, resolve(release, '.env'))

if (existsSync(resolve(root, 'database'))) {
  cpSync(resolve(root, 'database'), resolve(release, 'database'), { recursive: true })
}

mkdirSync(resolve(release, 'announcements/uploads'), { recursive: true })
mkdirSync(resolve(release, 'calendar/uploads'), { recursive: true })
mkdirSync(resolve(release, 'projects/uploads'), { recursive: true })
mkdirSync(resolve(release, 'council/uploads'), { recursive: true })
mkdirSync(resolve(release, 'council/people'), { recursive: true })
if (existsSync(resolve(root, 'public/council/people'))) {
  cpSync(resolve(root, 'public/council/people'), resolve(release, 'council/people'), {
    recursive: true,
  })
}
mkdirSync(resolve(release, 'storage/requests'), { recursive: true })
if (existsSync(resolve(root, 'storage/.htaccess'))) {
  copyFileSync(resolve(root, 'storage/.htaccess'), resolve(release, 'storage/.htaccess'))
}

writeFileSync(
  resolve(release, '.htaccess'),
  `# PUP COL-SC production
Options -Indexes

<IfModule mod_authz_core.c>
  <FilesMatch "^\\.env">
    Require all denied
  </FilesMatch>
</IfModule>

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Block direct access to SQL / schema dumps and private storage
  RewriteRule ^database(/|$) - [F,L]
  RewriteRule ^storage(/|$) - [F,L]

  # Existing files and API scripts
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # SPA fallback
  RewriteRule ^ index.html [L]
</IfModule>
`,
)

writeFileSync(
  resolve(release, 'api/.htaccess'),
  `Header always set X-Content-Type-Options nosniff

<IfModule mod_authz_core.c>
  <FilesMatch "^\\.env">
    Require all denied
  </FilesMatch>
</IfModule>
`,
)

console.log('Production package ready:', release)
console.log('Upload the contents of /release to your Hostinger public_html.')
