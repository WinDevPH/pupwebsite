import { useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { THEME_CHART } from '@/lib/dashboard-stats'
import { formatReservationMoney } from '@/lib/reservations-api'
import { pesosCompact, type IncomeSeriesPoint } from '@/lib/income-report'

function niceMax(value: number) {
  const n = Math.max(0, Number(value) || 0)
  if (n <= 100) return 100
  if (n <= 500) return 500
  if (n <= 1000) return 1000
  const exp = 10 ** Math.floor(Math.log10(n))
  const scaled = n / exp
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return step * exp
}

function roundTopBar(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0 || w <= 0) return ''
  const radius = Math.min(r, w / 2, h)
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + w - radius} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + radius}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ')
}

export function IncomeBarChart({ series = [] }: { series?: IncomeSeriesPoint[] }) {
  const gid = useId().replace(/:/g, '')
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{
    index: number
    x: number
    y: number
    boxW: number
    boxH: number
  } | null>(null)

  const width = 640
  const height = 248
  const pad = { top: 12, right: 4, bottom: 28, left: 44 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const count = Math.max(series.length, 1)
  const peak = Math.max(...series.map((row) => Math.max(row.merch || 0, row.locker || 0)), 0)
  const max = niceMax(peak || 100)
  const ticks = 4
  const groupW = innerW / count
  const barW = Math.min(16, Math.max(4, groupW * 0.28))
  const gap = Math.min(6, Math.max(2, barW * 0.28))
  const showEvery = count > 14 ? Math.ceil(count / 12) : 1

  const tickVals = useMemo(
    () => Array.from({ length: ticks + 1 }, (_, i) => (max / ticks) * (ticks - i)),
    [max],
  )

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box || box.width <= 0) return
    const x = event.clientX - box.left
    const y = event.clientY - box.top
    const vx = (x / box.width) * width
    if (vx < pad.left || vx > width - pad.right) {
      setHover(null)
      return
    }
    const index = Math.min(count - 1, Math.max(0, Math.floor((vx - pad.left) / groupW)))
    setHover({ index, x, y, boxW: box.width, boxH: box.height })
  }

  const active = hover ? series[hover.index] : null
  const tooltip = (() => {
    if (!hover || !active) return null
    const tipW = 176
    const tipH = 108
    let left = hover.x + 14
    let top = hover.y - tipH - 10
    if (left + tipW > hover.boxW - 4) left = hover.x - tipW - 14
    if (left < 4) left = 4
    if (top < 4) top = hover.y + 16
    if (top + tipH > hover.boxH - 4) top = Math.max(4, hover.boxH - tipH - 4)
    return { left, top }
  })()

  return (
    <div
      ref={wrapRef}
      className="relative h-full min-h-[11rem] w-full cursor-crosshair sm:min-h-[13rem] lg:min-h-[10rem]"
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHover(null)}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label="Merch and locker income over time"
      >
        <defs>
          <linearGradient id={`${gid}-merch`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={THEME_CHART.requests.to} />
            <stop offset="55%" stopColor={THEME_CHART.requests.mid} />
            <stop offset="100%" stopColor={THEME_CHART.requests.from} />
          </linearGradient>
          <linearGradient id={`${gid}-locker`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={THEME_CHART.reservations.to} />
            <stop offset="55%" stopColor={THEME_CHART.reservations.mid} />
            <stop offset="100%" stopColor={THEME_CHART.reservations.from} />
          </linearGradient>
        </defs>

        {tickVals.map((val) => {
          const y = pad.top + innerH - (val / max) * innerH
          return (
            <g key={val}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                className="stroke-zinc-100 dark:stroke-zinc-800"
                strokeWidth="1"
              />
              <text
                x={pad.left - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-zinc-400 dark:fill-zinc-500"
                fontSize="9"
              >
                {pesosCompact(val)}
              </text>
            </g>
          )
        })}

        {hover ? (
          <rect
            x={pad.left + groupW * hover.index}
            y={pad.top}
            width={groupW}
            height={innerH}
            className="fill-brand-500/[0.07] dark:fill-white/[0.06]"
          />
        ) : null}

        {series.map((row, i) => {
          const cx = pad.left + groupW * i + groupW / 2
          const merchH = ((row.merch || 0) / max) * innerH
          const lockerH = ((row.locker || 0) / max) * innerH
          const merchX = cx - barW - gap / 2
          const lockerX = cx + gap / 2
          const base = pad.top + innerH
          const dim = hover && hover.index !== i
          return (
            <g
              key={row.key || row.label}
              className="transition-opacity duration-150"
              opacity={dim ? 0.38 : 1}
            >
              {merchH > 0 ? (
                <path d={roundTopBar(merchX, base - merchH, barW, merchH, 8)} fill={`url(#${gid}-merch)`} />
              ) : null}
              {lockerH > 0 ? (
                <path
                  d={roundTopBar(lockerX, base - lockerH, barW, lockerH, 8)}
                  fill={`url(#${gid}-locker)`}
                />
              ) : null}
              {i % showEvery === 0 ? (
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  className={
                    hover?.index === i
                      ? 'fill-brand-600 dark:fill-brand-300'
                      : 'fill-zinc-400 dark:fill-zinc-500'
                  }
                  fontSize="10"
                  fontWeight={hover?.index === i ? 700 : 400}
                >
                  {row.label}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>

      {hover && active && tooltip ? (
        <div
          className="pointer-events-none absolute z-20 w-[11rem] rounded-xl border border-zinc-200 bg-white px-3 py-2.5 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
          style={{ left: tooltip.left, top: tooltip.top }}
          role="tooltip"
        >
          <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-50">{active.label}</p>
          <div className="mt-2 space-y-1.5">
            <p className="flex items-center justify-between gap-3 text-[11.5px]">
              <span className="inline-flex items-center gap-1.5 text-zinc-500">
                <i
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: `linear-gradient(180deg,${THEME_CHART.requests.from},${THEME_CHART.requests.to})`,
                  }}
                />
                Merch
              </span>
              <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatReservationMoney(active.merch)}
              </span>
            </p>
            <p className="flex items-center justify-between gap-3 text-[11.5px]">
              <span className="inline-flex items-center gap-1.5 text-zinc-500">
                <i
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: `linear-gradient(180deg,${THEME_CHART.reservations.from},${THEME_CHART.reservations.to})`,
                  }}
                />
                Locker
              </span>
              <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatReservationMoney(active.locker)}
              </span>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
