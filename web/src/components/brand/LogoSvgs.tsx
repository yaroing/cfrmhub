import { useId } from 'react'

function gradId(raw: string, suffix: string) {
  return `cfrm-${raw.replace(/[^a-zA-Z0-9]/g, '')}-${suffix}`
}

/** Pictogramme bulle + hub : couleurs via variables CSS (thème clair / sombre). */
export function LogoMarkSvg({ className }: { className?: string }) {
  const id = useId()
  const b = gradId(id, 'b')
  const a = gradId(id, 'a')
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={b} x1="8" y1="12" x2="56" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--logo-bubble-a)" />
          <stop offset="1" stopColor="var(--logo-bubble-b)" />
        </linearGradient>
        <linearGradient id={a} x1="32" y1="20" x2="48" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--logo-accent-a)" />
          <stop offset="1" stopColor="var(--logo-accent-b)" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${b})`}
        d="M52 14H20c-4.42 0-8 3.58-8 8v18c0 4.42 3.58 8 8 8h6.5l-4.8 9.6c-.65 1.3.58 2.75 1.85 2.1L36 48h16c4.42 0 8-3.58 8-8V22c0-4.42-3.58-8-8-8Z"
      />
      <circle cx="32" cy="30" r="5" fill="var(--logo-on-bubble)" fillOpacity={0.95} />
      <circle cx="22" cy="24" r="3.25" fill={`url(#${a})`} />
      <circle cx="42" cy="24" r="3.25" fill="var(--logo-on-bubble-muted)" fillOpacity={0.95} />
      <circle cx="32" cy="38" r="3.25" fill="var(--logo-on-bubble-muted)" fillOpacity={0.9} />
      <path
        stroke="var(--logo-hub-line)"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M24.6 25.4 29.2 28M39.4 25.4 34.8 28M32 35v-3"
      />
    </svg>
  )
}

/** Wordmark + pictogramme : texte lié au thème (--text-heading, --logo-word-hub). */
export function LogoFullSvg({ className }: { className?: string }) {
  const id = useId()
  const b = gradId(id, 'fb')
  const ac = gradId(id, 'fa')
  return (
    <svg
      className={className}
      viewBox="0 0 220 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="CFRM Hub"
    >
      <defs>
        <linearGradient id={b} x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--logo-bubble-a)" />
          <stop offset="1" stopColor="var(--logo-bubble-b)" />
        </linearGradient>
        <linearGradient id={ac} x1="20" y1="16" x2="44" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--logo-accent-a)" />
          <stop offset="1" stopColor="var(--logo-accent-b)" />
        </linearGradient>
      </defs>
      <g transform="translate(0 4)">
        <path
          fill={`url(#${b})`}
          d="M44 6H16C11.58 6 8 9.58 8 14v14c0 4.42 3.58 8 8 8h5.2L9.4 43.2c-.52 1.04.46 2.2 1.48 1.68L28 36h16c4.42 0 8-3.58 8-8V14c0-4.42-3.58-8-8-8Z"
        />
        <circle cx="28" cy="22" r="4.2" fill="var(--logo-on-bubble)" fillOpacity={0.95} />
        <circle cx="19.5" cy="17" r="2.7" fill={`url(#${ac})`} />
        <circle cx="36.5" cy="17" r="2.7" fill="var(--logo-on-bubble-muted)" fillOpacity={0.95} />
        <circle cx="28" cy="29" r="2.7" fill="var(--logo-on-bubble-muted)" fillOpacity={0.9} />
        <path
          stroke="var(--logo-hub-line)"
          strokeWidth="1.2"
          strokeLinecap="round"
          d="M21.5 17.8l3.6 2.2M34.5 17.8 31 20M28 27.5v-2.5"
        />
      </g>
      <text
        x={64}
        y={38}
        fill="var(--text-heading)"
        style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif' }}
        fontSize={22}
        fontWeight={700}
        letterSpacing="-0.02em"
      >
        CFRM
      </text>
      <text
        x={124}
        y={38}
        fill="var(--logo-word-hub)"
        style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif' }}
        fontSize={22}
        fontWeight={500}
        letterSpacing="-0.01em"
      >
        {' Hub'}
      </text>
    </svg>
  )
}
