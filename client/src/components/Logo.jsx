/** Combined FieldPulse + 6 Armd Div mark: black/gold division colours, numeral 6, armour + pulse. */
export default function Logo({ size = 52 }) {
  return (
    <svg
      className="brand-logo"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fpGold" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f0d78c" />
          <stop offset="0.45" stopColor="#c9a227" />
          <stop offset="1" stopColor="#8a7010" />
        </linearGradient>
        <linearGradient id="fpShield" x1="32" y1="4" x2="32" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1a1a1a" />
          <stop offset="1" stopColor="#050505" />
        </linearGradient>
      </defs>

      {/* Shield / patch */}
      <path
        d="M32 4L54 12v18c0 14.5-9.2 24.8-22 28.8C19.2 54.8 10 44.5 10 30V12L32 4z"
        fill="url(#fpShield)"
        stroke="url(#fpGold)"
        strokeWidth="2"
      />

      {/* Pulse arcs — FieldPulse / battlefield sensing */}
      <path
        d="M18 34c4.2-7.5 9.2-11.2 14-11.2S41.8 26.5 46 34"
        stroke="#3dba8a"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M22 37c3-5.2 6.6-7.8 10-7.8s7 2.6 10 7.8"
        stroke="url(#fpGold)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Stylised armour hull */}
      <path
        d="M20 40.5h24l-2.2 4.2H22.2L20 40.5z"
        fill="#c9a227"
        opacity="0.95"
      />
      <rect x="23" y="38" width="5.5" height="3.2" rx="0.6" fill="#f0d78c" />
      <rect x="35.5" y="38" width="5.5" height="3.2" rx="0.6" fill="#f0d78c" />
      <path d="M44 39.2h6.5l1.2 2.2H44V39.2z" fill="#e6c65c" />

      {/* Numeral 6 — division identity */}
      <text
        x="32"
        y="30"
        textAnchor="middle"
        fontFamily="'IBM Plex Sans', system-ui, sans-serif"
        fontSize="18"
        fontWeight="700"
        fill="url(#fpGold)"
      >
        6
      </text>

      {/* Center pulse node */}
      <circle cx="32" cy="34.5" r="2.2" fill="#3dba8a" />
    </svg>
  );
}
