// Small inline SVG diagrams used by rulebook topics. Each is a pure
// component so topic files stay focused on text + structure.

export function HexProductionDiagram() {
  // A wheat hex with number token 8 and three settlements/cities around it.
  return (
    <svg viewBox="-80 -70 160 140" className="rb-diagram" aria-hidden>
      <polygon
        points="0,-60 52,-30 52,30 0,60 -52,30 -52,-30"
        fill="var(--terrain-wheat)"
        stroke="#1a1a1a"
        strokeWidth="1.5"
      />
      <circle cx="0" cy="0" r="14" fill="var(--token-fill)" stroke="var(--token-edge)" strokeWidth="1.5" />
      <text x="0" y="3" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--token-hot)">
        8
      </text>
      {/* Settlements at top corners */}
      <g transform="translate(0,-60)">
        <path d="M-7,5 L-7,-2 L0,-7 L7,-2 L7,5 Z" fill="var(--player-red)" stroke="#1a1a1a" strokeWidth="1" />
      </g>
      <g transform="translate(52,30)">
        <path d="M-7,5 L-7,-2 L0,-7 L7,-2 L7,5 Z" fill="var(--player-blue)" stroke="#1a1a1a" strokeWidth="1" />
      </g>
      {/* A city at the bottom-left corner */}
      <g transform="translate(-52,30)">
        <path
          d="M-10,8 L-10,-4 L-3,-4 L-3,-9 L4,-9 L4,-4 L10,-4 L10,8 Z"
          fill="var(--player-orange)"
          stroke="#1a1a1a"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}

export function PiecesDiagram() {
  // Road, settlement, city side by side with labels.
  return (
    <svg viewBox="0 0 240 80" className="rb-diagram" aria-hidden>
      {/* Road */}
      <g transform="translate(40,40)">
        <line x1="-22" y1="0" x2="22" y2="0" stroke="#1a1a1a" strokeWidth="8" strokeLinecap="round" />
        <line x1="-22" y1="0" x2="22" y2="0" stroke="var(--player-red)" strokeWidth="5" strokeLinecap="round" />
        <text x="0" y="32" textAnchor="middle" fontSize="11" fill="var(--text-soft)">
          Road
        </text>
      </g>
      {/* Settlement */}
      <g transform="translate(120,40)">
        <path d="M-12,9 L-12,-3 L0,-12 L12,-3 L12,9 Z" fill="var(--player-blue)" stroke="#1a1a1a" strokeWidth="1.5" />
        <text x="0" y="32" textAnchor="middle" fontSize="11" fill="var(--text-soft)">
          Settlement (1 VP)
        </text>
      </g>
      {/* City */}
      <g transform="translate(200,40)">
        <path
          d="M-15,12 L-15,-6 L-5,-6 L-5,-13 L6,-13 L6,-6 L15,-6 L15,12 Z"
          fill="var(--player-orange)"
          stroke="#1a1a1a"
          strokeWidth="1.5"
        />
        <text x="0" y="32" textAnchor="middle" fontSize="11" fill="var(--text-soft)">
          City (2 VP)
        </text>
      </g>
    </svg>
  );
}

export function DistanceRuleDiagram() {
  // Two vertices with a road between, showing a forbidden adjacency.
  return (
    <svg viewBox="-100 -45 200 90" className="rb-diagram" aria-hidden>
      <line x1="-60" y1="0" x2="60" y2="0" stroke="#1a1a1a" strokeWidth="8" strokeLinecap="round" />
      <line
        x1="-60"
        y1="0"
        x2="60"
        y2="0"
        stroke="var(--player-red)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Existing settlement on left */}
      <g transform="translate(-60,0)">
        <path d="M-9,6 L-9,-2 L0,-9 L9,-2 L9,6 Z" fill="var(--player-red)" stroke="#1a1a1a" strokeWidth="1.2" />
      </g>
      {/* Forbidden settlement on the adjacent vertex */}
      <g transform="translate(60,0)">
        <circle r="13" fill="none" stroke="var(--danger)" strokeWidth="2" strokeDasharray="3 3" />
        <line x1="-9" y1="-9" x2="9" y2="9" stroke="var(--danger)" strokeWidth="2" />
        <line x1="-9" y1="9" x2="9" y2="-9" stroke="var(--danger)" strokeWidth="2" />
      </g>
      <text x="-60" y="-22" textAnchor="middle" fontSize="10" fill="var(--text-soft)">
        Your settlement
      </text>
      <text x="60" y="-22" textAnchor="middle" fontSize="10" fill="var(--danger)">
        Can't settle here
      </text>
    </svg>
  );
}

export function CostsDiagram() {
  // Build-cost reference list.
  const rows: { label: string; cost: string }[] = [
    { label: 'Road', cost: '🌲 1   🧱 1' },
    { label: 'Settlement', cost: '🌲 1   🧱 1   🐑 1   🌾 1' },
    { label: 'City', cost: '🌾 2   🪨 3' },
    { label: 'Dev card', cost: '🐑 1   🌾 1   🪨 1' },
  ];
  return (
    <table className="rb-costs">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th>{r.label}</th>
            <td>{r.cost}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RobberDiagram() {
  // A hex with the robber sitting on it.
  return (
    <svg viewBox="-70 -60 140 120" className="rb-diagram" aria-hidden>
      <polygon
        points="0,-60 52,-30 52,30 0,60 -52,30 -52,-30"
        fill="var(--terrain-ore)"
        stroke="#1a1a1a"
        strokeWidth="1.5"
      />
      <circle cx="0" cy="0" r="14" fill="var(--token-fill)" stroke="var(--token-edge)" strokeWidth="1.5" />
      <text x="0" y="3" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1a1a1a">
        6
      </text>
      {/* Robber pawn */}
      <g transform="translate(0,-22)">
        <ellipse cx="0" cy="14" rx="9" ry="4" fill="#1a1a1a" opacity="0.4" />
        <path
          d="M-7,10 L-7,-6 Q-7,-10 -3,-10 L3,-10 Q7,-10 7,-6 L7,10 Z"
          fill="#1a1a1a"
          stroke="#fff"
          strokeWidth="1"
        />
        <circle cx="0" cy="-12" r="4" fill="#1a1a1a" stroke="#fff" strokeWidth="1" />
      </g>
    </svg>
  );
}

export function PortDiagram() {
  // A coastal port — generic 3:1 and a specific 2:1 wheat port.
  return (
    <svg viewBox="0 0 240 80" className="rb-diagram" aria-hidden>
      <g transform="translate(60,40)">
        <circle r="22" fill="var(--panel-soft)" stroke="#ffffff" strokeWidth="2" />
        <text x="0" y="4" textAnchor="middle" fontSize="14" fontWeight="700" fill="#ffffff">
          3:1
        </text>
        <text x="0" y="38" textAnchor="middle" fontSize="11" fill="var(--text-soft)">
          Any resource
        </text>
      </g>
      <g transform="translate(180,40)">
        <circle r="22" fill="var(--terrain-wheat)" stroke="#ffffff" strokeWidth="2" />
        <text x="0" y="4" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1a1a1a">
          2:1
        </text>
        <text x="0" y="38" textAnchor="middle" fontSize="11" fill="var(--text-soft)">
          Wheat only
        </text>
      </g>
    </svg>
  );
}
