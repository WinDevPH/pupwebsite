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

for (const bucket of [
  'announcements',
  'calendar',
  'council',
  'gallery',
  'hero',
  'projects',
  'shop',
  'users',
  'org-logos',
]) {
  mkdirSync(resolve(release, 'uploads', bucket), { recursive: true })
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

  # Old picture URLs → /uploads/{bucket}/
  RewriteRule ^(announcements|calendar|projects|council|gallery|hero|users|shop)/uploads/(.*)$ /uploads/$1/$2 [L]
  RewriteRule ^hero/seed/(.*)$ /uploads/hero/$1 [L]
  RewriteRule ^gallery/seed/(.*)$ /uploads/gallery/$1 [L]
  RewriteRule ^council/people/(.*)$ /uploads/council/$1 [L]
  RewriteRule ^calendar/defaults/(.*)$ /uploads/calendar/$1 [L]
  RewriteRule ^org-logos/(.*)$ /uploads/org-logos/$1 [L]
  RewriteRule ^announcements/(.+\\.(jpe?g|png|webp|gif|svg))$ /uploads/announcements/$1 [NC,L]
  RewriteRule ^calendar/(.+\\.(jpe?g|png|webp|gif|svg))$ /uploads/calendar/$1 [NC,L]
  RewriteRule ^projects/(.+\\.(jpe?g|png|webp|gif|svg))$ /uploads/projects/$1 [NC,L]
  RewriteRule ^shop/(.+\\.(jpe?g|png|webp|gif|svg))$ /uploads/shop/$1 [NC,L]
  RewriteRule ^hero/(.+\\.(jpe?g|png|webp|gif|svg))$ /uploads/hero/$1 [NC,L]
  RewriteRule ^gallery/(.+\\.(jpe?g|png|webp|gif|svg))$ /uploads/gallery/$1 [NC,L]
  RewriteRule ^council/(.+\\.(jpe?g|png|webp|gif|svg))$ /uploads/council/$1 [NC,L]

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
