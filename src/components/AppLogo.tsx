/** Same mark as public/favicon.svg. */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" className="fill-primary" />
      <g className="stroke-on-primary" fill="none" strokeWidth="4" strokeLinecap="round">
        <circle cx="32" cy="32" r="17" />
        <path d="M24 26h16M32 26v16M26 34h12" />
      </g>
    </svg>
  )
}
