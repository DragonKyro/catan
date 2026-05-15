// Inline SVG diagrams for the Seafarers rulebook section. Style matches the
// base-game diagrams: small, low-contrast, render at the user's text size.

export function ShipDiagram() {
  return (
    <svg width="100%" height={70} viewBox="0 0 240 70" style={{ display: 'block' }}>
      {/* Sea backdrop */}
      <rect width="240" height="70" fill="#2a5a8a" rx="6" />
      <g transform="translate(48, 38)">
        {/* hull */}
        <path d="M-20,4 L20,4 L16,12 L-16,12 Z" fill="#d94545" stroke="#1a1a1a" strokeWidth="1" />
        {/* mast */}
        <line x1="0" y1="4" x2="0" y2="-16" stroke="#1a1a1a" strokeWidth="1.2" />
        {/* sail */}
        <path d="M0,-16 L13,-3 L0,-3 Z" fill="#fdfbf3" stroke="#1a1a1a" strokeWidth="0.8" />
      </g>
      <g transform="translate(140, 38)">
        <path d="M-20,4 L20,4 L16,12 L-16,12 Z" fill="#3a6ec9" stroke="#1a1a1a" strokeWidth="1" />
        <line x1="0" y1="4" x2="0" y2="-16" stroke="#1a1a1a" strokeWidth="1.2" />
        <path d="M0,-16 L13,-3 L0,-3 Z" fill="#fdfbf3" stroke="#1a1a1a" strokeWidth="0.8" />
      </g>
      <text x="48" y="64" textAnchor="middle" fontSize="10" fill="#cfe5ff">Ship</text>
      <text x="140" y="64" textAnchor="middle" fontSize="10" fill="#cfe5ff">Ship</text>
    </svg>
  );
}

export function GoldHexDiagram() {
  return (
    <svg width="100%" height={90} viewBox="0 0 200 90" style={{ display: 'block' }}>
      {/* Gold hex */}
      <polygon
        points="100,10 145,35 145,75 100,100 55,75 55,35"
        fill="#e7c047"
        stroke="#1a1a1a40"
        strokeWidth="1.5"
        transform="translate(0,-10)"
      />
      <circle cx="100" cy="44" r="15" fill="#f7f1d8" stroke="#4a3a25" strokeWidth="1.5" />
      <text x="100" y="48" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1a1a1a">8</text>
      <circle cx="80" cy="30" r="2" fill="#fff3a8" />
      <circle cx="120" cy="30" r="2" fill="#fff3a8" />
    </svg>
  );
}

export function PirateDiagram() {
  return (
    <svg width="100%" height={70} viewBox="0 0 200 70" style={{ display: 'block' }}>
      <rect width="200" height="70" fill="#2a5a8a" rx="6" />
      <g transform="translate(100, 40)">
        <ellipse cx="0" cy="14" rx="14" ry="3" fill="#00000080" />
        <path d="M-15,4 L15,4 L12,12 L-12,12 Z" fill="#1a1a1a" stroke="#fefefe" strokeWidth="1" />
        <line x1="0" y1="4" x2="0" y2="-16" stroke="#1a1a1a" strokeWidth="1.4" />
        <path d="M0,-16 L11,-3 L0,-3 Z" fill="#1a1a1a" stroke="#fefefe" strokeWidth="1" />
        <circle cx="4" cy="-8" r="1.6" fill="#fefefe" />
      </g>
    </svg>
  );
}

export function IslandBonusDiagram() {
  return (
    <svg width="100%" height={110} viewBox="0 0 240 110" style={{ display: 'block' }}>
      <rect width="240" height="110" fill="#2a5a8a" rx="6" />
      {/* Outer island (small) */}
      <polygon
        points="60,30 90,45 90,75 60,90 30,75 30,45"
        fill="#3d7a3d"
        stroke="#1a1a1a40"
        strokeWidth="1.5"
      />
      {/* Settlement marker */}
      <path
        d="M62,50 L70,50 L70,58 L78,58 L70,42 L62,58 Z"
        fill="#d94545"
        stroke="#1a1a1a"
        strokeWidth="0.8"
        transform="translate(-12, 5)"
      />
      <text x="60" y="105" textAnchor="middle" fontSize="11" fill="#cfe5ff">
        First settler: +2 VP
      </text>
      {/* Chip badge */}
      <g transform="translate(170, 55)">
        <circle r="22" fill="#f5b223" stroke="#4a3a25" strokeWidth="2" />
        <text textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="700" fill="#1a1a1a">+2</text>
      </g>
      <text x="170" y="105" textAnchor="middle" fontSize="11" fill="#cfe5ff">
        Island chip
      </text>
    </svg>
  );
}

export function TradeRouteDiagram() {
  return (
    <svg width="100%" height={90} viewBox="0 0 280 90" style={{ display: 'block' }}>
      <rect width="280" height="90" fill="#2a5a8a" rx="6" />
      {/* land sample under the road */}
      <rect x="0" y="50" width="120" height="40" fill="#3d7a3d" opacity="0.55" />
      {/* Road segment */}
      <line x1="20" y1="50" x2="80" y2="50" stroke="#1a1a1a" strokeWidth="8" strokeLinecap="round" />
      <line x1="20" y1="50" x2="80" y2="50" stroke="#d94545" strokeWidth="5" strokeLinecap="round" />
      {/* Settlement at the junction */}
      <path d="M82,40 L82,50 L98,50 L98,40 L90,30 Z" fill="#d94545" stroke="#1a1a1a" strokeWidth="0.8" />
      {/* Ship segment */}
      <g transform="translate(140, 50) rotate(0)">
        <path d="M-20,2 L20,2 L16,8 L-16,8 Z" fill="#d94545" stroke="#1a1a1a" strokeWidth="1" />
        <line x1="0" y1="2" x2="0" y2="-12" stroke="#1a1a1a" strokeWidth="1.2" />
        <path d="M0,-12 L11,-1 L0,-1 Z" fill="#fdfbf3" stroke="#1a1a1a" strokeWidth="0.8" />
      </g>
      <g transform="translate(220, 50)">
        <path d="M-20,2 L20,2 L16,8 L-16,8 Z" fill="#d94545" stroke="#1a1a1a" strokeWidth="1" />
        <line x1="0" y1="2" x2="0" y2="-12" stroke="#1a1a1a" strokeWidth="1.2" />
        <path d="M0,-12 L11,-1 L0,-1 Z" fill="#fdfbf3" stroke="#1a1a1a" strokeWidth="0.8" />
      </g>
      <text x="140" y="86" textAnchor="middle" fontSize="11" fill="#cfe5ff">
        Trade route length 3 (road + settlement + ship + ship)
      </text>
    </svg>
  );
}
