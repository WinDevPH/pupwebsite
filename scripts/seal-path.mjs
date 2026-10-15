import { readFileSync, writeFileSync } from 'node:fs'

function points() {
  const vbW = 240
  const vbH = 64
  const amp = 4.2
  const margin = amp + 1.5
  const cy = vbH / 2
  const R = vbH / 2 - margin
  const xL = margin + R
  const xR = vbW - margin - R
  const wavesTop = 12
  const wavesCap = 4
  const out = []
  const add = (x, y) => out.push([+x.toFixed(2), +y.toFixed(2)])

  const topSteps = wavesTop * 10
  for (let i = 0; i <= topSteps; i++) {
    const t = i / topSteps
    const x = xL + (xR - xL) * t
    const y = cy - R - amp * Math.cos(t * wavesTop * Math.PI * 2)
    add(x, y)
  }

  const capSteps = wavesCap * 10
  for (let i = 1; i <= capSteps; i++) {
    const t = i / capSteps
    const a = -Math.PI / 2 + t * Math.PI
    const r = R + amp * Math.cos(t * wavesCap * Math.PI * 2)
    add(xR + Math.cos(a) * r, cy + Math.sin(a) * r)
  }

  for (let i = 1; i <= topSteps; i++) {
    const t = i / topSteps
    const x = xR - (xR - xL) * t
    const y = cy + R + amp * Math.cos(t * wavesTop * Math.PI * 2)
    add(x, y)
  }

  for (let i = 1; i < capSteps; i++) {
    const t = i / capSteps
    const a = Math.PI / 2 + t * Math.PI
    const r = R + amp * Math.cos(t * wavesCap * Math.PI * 2)
    add(xL + Math.cos(a) * r, cy + Math.sin(a) * r)
  }

  return { vbW, vbH, d: `M${out.map((p) => p.join(',')).join('L')}Z` }
}

const { vbW, vbH, d } = points()
const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${vbW} ${vbH}'><path fill='black' d='${d}'/></svg>`
const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`
const cssPath = new URL('../src/index.css', import.meta.url)
let css = readFileSync(cssPath, 'utf8')
css = css.replace(/url\("data:image\/svg\+xml,[^"]+"\)/g, `url("${uri}")`)
writeFileSync(cssPath, css)
console.log('updated masks', (css.match(/data:image\/svg\+xml/g) || []).length)
