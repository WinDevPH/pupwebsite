type SidebarLayoutToggleIconProps = {
  className?: string
  mode: 'expand' | 'collapse'
}

const frameProps = {
  x: '3',
  y: '3',
  width: '18',
  height: '18',
  rx: '4',
  stroke: 'currentColor',
  strokeWidth: '1.75',
  fill: 'none' as const,
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: '1.75',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function SidebarLayoutToggleIcon({
  className = 'size-[18px]',
  mode,
}: SidebarLayoutToggleIconProps) {
  const mirror = mode === 'expand'

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <g transform={mirror ? 'translate(24 0) scale(-1 1)' : undefined}>
        <rect {...frameProps} />
        <path d="M16.25 5.5v13" {...stroke} />
        <path d="M8.25 8.75 11.25 12 8.25 15.25" {...stroke} />
      </g>
    </svg>
  )
}
