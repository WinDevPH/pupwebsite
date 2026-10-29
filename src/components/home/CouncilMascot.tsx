/** Exclusive PUP COL SC chat envoy — robe, gold sash, and a raised greeting. */
export function CouncilMascot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 76"
      className={className}
      aria-hidden
      focusable="false"
    >
      <ellipse cx="32" cy="72" rx="14" ry="3.2" fill="#1e0541" opacity="0.16" />

      <path
        d="M18 40c1.2 16 4.6 26 14 26s12.8-10 14-26c-4.2 3.2-9.2 4.6-14 4.6S22.2 43.2 18 40Z"
        fill="#5f18b8"
      />
      <path
        d="M20.5 42c1.4 13.4 4.2 21.6 11.5 21.6 7.3 0 10.1-8.2 11.5-21.6-3.6 2.4-7.5 3.4-11.5 3.4s-7.9-1-11.5-3.4Z"
        fill="#491293"
      />
      <path d="M32 43.5 24 70h16L32 43.5Z" fill="#f2b705" />
      <path d="M32 43.5 28.4 70h7.2L32 43.5Z" fill="#ffe38f" />

      <circle cx="32" cy="26" r="16.4" fill="#f6efe6" />
      <circle cx="32" cy="27.2" r="15.2" fill="#fff8f1" />

      <path
        d="M17.6 24c2.4-10 9-15.6 14.4-15.6 5.6 0 12.2 5.8 14.4 15.8-3.8-3-8.8-4.6-14.4-4.6-5.5 0-10.4 1.6-14.4 4.4Z"
        fill="#1e0541"
      />
      <path d="M22 13.2c3.2-2.4 7-3.4 10-3.4 3.2 0 7 1 10.2 3.5-2.4-3.6-6-6-10.2-6-4.1 0-7.7 2.3-10 5.9Z" fill="#330c69" />
      <rect x="16.2" y="20.4" width="31.6" height="4.2" rx="2.1" fill="#f2b705" />
      <circle cx="32" cy="12.4" r="3.1" fill="#f2b705" />
      <path d="M32 9.8v5.2M29.4 12.4h5.2" stroke="#7a1212" strokeWidth="1.1" strokeLinecap="round" />

      <circle cx="26.2" cy="28.2" r="1.7" fill="#1e0541" />
      <circle cx="37.8" cy="28.2" r="1.7" fill="#1e0541" />
      <circle cx="26.7" cy="27.7" r="0.55" fill="#fff" />
      <circle cx="38.3" cy="27.7" r="0.55" fill="#fff" />
      <path
        d="M28.4 33.4c1.1 1.5 2.3 2.2 3.6 2.2s2.5-.7 3.6-2.2"
        fill="none"
        stroke="#7a1212"
        strokeWidth="1.35"
        strokeLinecap="round"
      />

      <g className="chat-mascot-arm">
        <path
          d="M15.2 41.5c-4.4-6.4-2.2-12.2 1.4-14.2 1.2-.6 2.4.4 2.1 1.7l-1.8 8.4c3.2 1.4 5.2 3.4 6.3 5.6-3.6.4-6.2-.2-8-1.5Z"
          fill="#fff8f1"
        />
        <circle cx="14.4" cy="28.6" r="3.35" fill="#fff8f1" />
        <circle cx="14.4" cy="28.6" r="1.55" fill="#f2b705" />
      </g>

      <path d="M39.4 42.5c3.8 1.8 6.4 1.4 8.2-.2-1.8 5.4-5.4 8.4-9.6 9.2 0-3.2.4-6.2 1.4-9Z" fill="#fff8f1" />
    </svg>
  )
}
