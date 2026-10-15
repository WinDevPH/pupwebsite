import { readFileSync, writeFileSync } from 'node:fs'

const p = new URL('../src/index.css', import.meta.url)
let css = readFileSync(p, 'utf8')
const i = css.indexOf('.seal-kicker {')
if (i < 0) throw new Error('missing')

const next = `.seal-kicker {
  position: relative;
  z-index: 0;
  isolation: isolate;
  border: 0;
  background: transparent;
  padding: 0.5rem 1rem;
}

.seal-kicker::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background: #ffffff;
  --s: 11px;
  --r: 5.5px;
  -webkit-mask:
    linear-gradient(#000 0 0) center / calc(100% - var(--s)) calc(100% - var(--s)) no-repeat,
    radial-gradient(circle var(--r) at 50% var(--r), #000 99%, #0000) top / var(--s) 100% round,
    radial-gradient(circle var(--r) at 50% calc(100% - var(--r)), #000 99%, #0000) bottom / var(--s) 100% round,
    radial-gradient(circle var(--r) at var(--r) 50%, #000 99%, #0000) left / 100% var(--s) round,
    radial-gradient(circle var(--r) at calc(100% - var(--r)) 50%, #000 99%, #0000) right / 100% var(--s) round;
  mask:
    linear-gradient(#000 0 0) center / calc(100% - var(--s)) calc(100% - var(--s)) no-repeat,
    radial-gradient(circle var(--r) at 50% var(--r), #000 99%, #0000) top / var(--s) 100% round,
    radial-gradient(circle var(--r) at 50% calc(100% - var(--r)), #000 99%, #0000) bottom / var(--s) 100% round,
    radial-gradient(circle var(--r) at var(--r) 50%, #000 99%, #0000) left / 100% var(--s) round,
    radial-gradient(circle var(--r) at calc(100% - var(--r)) 50%, #000 99%, #0000) right / 100% var(--s) round;
  filter:
    drop-shadow(0 0 0.7px #7524db)
    drop-shadow(0 0 0.7px #7524db);
}

.seal-kicker-gold::before {
  background: #1e0541;
  filter:
    drop-shadow(0 0 0.7px #fcd34d)
    drop-shadow(0 0 0.7px #f2b705);
}
`

writeFileSync(p, css.slice(0, i) + next)
console.log('ok')
