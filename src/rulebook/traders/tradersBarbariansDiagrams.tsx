// Inline SVG diagrams / tables for the "Traders & Barbarians" scenario
// rulebook topics.

// A commodity hex: frame side with "X" markers, four interior paths to the
// centre plaza.
export function CommodityHexDiagram() {
  const cx = 70;
  const cy = 62;
  const r = 48;
  const corner = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  // Corners 0 NE … 5 N (as in the game); frame on the NW, NE and E edges
  // like the quarry.
  const cs = [-30, 30, 90, 150, 210, 270].map(corner);
  const pts = cs.map(([x, y]) => `${x},${y}`).join(' ');
  const pathCorners = [1, 2, 3, 4];
  const xEdges = [4, 5, 0];
  return (
    <svg className="rb-diagram" width="100%" height={150} viewBox="0 0 260 130" style={{ display: 'block' }}>
      <polygon points={pts} fill="#c86b3c" stroke="#1a1a1a" strokeWidth={1.2} />
      {pathCorners.map((c) => (
        <line key={c} x1={cs[c]![0]} y1={cs[c]![1]} x2={cx} y2={cy} stroke="#e6d39f" strokeWidth={5} strokeLinecap="round" />
      ))}
      <circle cx={cx} cy={cy} r={9} fill="#f1e5c4" stroke="#6b5230" strokeWidth={1.2} />
      {xEdges.map((d) => {
        const [x1, y1] = cs[d]!;
        const [x2, y2] = cs[(d + 1) % 6]!;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        return (
          <g key={d} transform={`translate(${mx}, ${my})`}>
            <circle r={6} fill="#9b1c1c" />
            <path d="M-2.8,-2.8 L2.8,2.8 M2.8,-2.8 L-2.8,2.8" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
          </g>
        );
      })}
      <g fontSize={9} fill="currentColor">
        <text x={132} y={22}>
          ✕ frame edges: no roads
        </text>
        <text x={132} y={52}>
          ━ interior paths: roads OK,
        </text>
        <text x={144} y={64}>
          wagons travel them
        </text>
        <text x={132} y={94}>
          ● centre plaza: no settlement;
        </text>
        <text x={144} y={106}>
          a wagon entering it stops,
        </text>
        <text x={144} y={118}>
          delivers and picks up
        </text>
      </g>
    </svg>
  );
}

// The wagon board: one column per level.
export function WagonBoardTable() {
  const rows = [
    { level: 1, mp: 4, drive: '—', gold: 1, next: '🌲 1 🐑 1 🪨 1' },
    { level: 2, mp: 5, drive: '6', gold: 2, next: '🌲 1 🐑 1 🪨 1' },
    { level: 3, mp: 6, drive: '5–6', gold: 3, next: '🌲 2 🐑 1 🪨 1' },
    { level: 4, mp: 7, drive: '4–6', gold: 4, next: '🌲 2 🐑 1 🪨 1' },
    { level: 5, mp: 7, drive: '3–6', gold: 5, next: '— (+1 VP)' },
  ];
  return (
    <table className="rb-costs">
      <thead>
        <tr>
          <th>Level</th>
          <td>MP</td>
          <td>Drive off on</td>
          <td>Delivery</td>
          <td>Next upgrade</td>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.level}>
            <th>{r.level}</th>
            <td>{r.mp}</td>
            <td>{r.drive}</td>
            <td>{r.gold} gold</td>
            <td>{r.next}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function WagonCostTable() {
  const rows = [
    { label: 'No road', cost: '2 MP' },
    { label: 'Your road', cost: '1 MP' },
    { label: "A rival's road", cost: '1 MP + 1 gold to its owner' },
    { label: 'Barbarian on the edge', cost: '+2 MP' },
    { label: '1 wheat (once per move)', cost: '+2 MP' },
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
