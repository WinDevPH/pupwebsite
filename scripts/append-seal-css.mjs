import { readFileSync, appendFileSync } from 'node:fs'

const svg = readFileSync(new URL('./seal-kicker.svg.txt', import.meta.url), 'utf8').trim()
const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`

const css = `
.seal-kicker {
  position: relative;
  z-index: 0;
  isolation: isolate;
  border: 0;
  background: transparent;
  padding: 0.48rem 1.05rem;
}

.seal-kicker::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background: #ffffff;
  -webkit-mask: url("${uri}") center / 100% 100% no-repeat;
  mask: url("${uri}") center / 100% 100% no-repeat;
  filter:
    drop-shadow(0 0 0.4px #7524db)
    drop-shadow(0 0 0.4px #7524db)
    drop-shadow(0 0 0.65px #bf9aff);
}

.seal-kicker-gold::before {
  background: #1e0541;
  filter:
    drop-shadow(0 0 0.45px #fcd34d)
    drop-shadow(0 0 0.45px #fcd34d)
    drop-shadow(0 0 0.6px #f2b705);
}
`

appendFileSync(new URL('../src/index.css', import.meta.url), css)
console.log('appended', css.length)
