// Inline SVG diagrams for the Barbarian Attack rulebook topics.

const COLOR = { purple: '#6b2f93', green: '#1d9a58', brown: '#8a5a2b' } as const;

function Pip({ x, y, color, face }: { x: number; y: number; color: string; face: number }) {
  const o = 3;
  const spots: Array<[number, number]> = (
    {
      1: [[0, 0]],
      2: [[-o, -o], [o, o]],
      3: [[-o, -o], [0, 0], [o, o]],
      4: [[-o, -o], [o, -o], [-o, o], [o, o]],
      5: [[-o, -o], [o, -o], [0, 0], [-o, o], [o, o]],
      6: [[-o, -o], [o, -o], [-o, 0], [o, 0], [-o, o], [o, o]],
    } as Record<number, Array<[number, number]>>
  )[face]!;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r={7} fill={color} />
      {spots.map(([sx, sy], i) => (
        <circle key={i} cx={sx} cy={sy} r={1.2} fill="#ffd54f" />
      ))}
    </g>
  );
}

// The castle tile: which die faces name which pair of edges for knight
// losses (the same orientation on every hex).
export function CastleEdgeKeyDiagram() {
  // Pointy-top hex, radius 46, centre (70, 60).
  const cx = 70;
  const cy = 60;
  const r = 46;
  const corners = [-30, 30, 90, 150, 210, 270].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
  // Edge d runs corner d → d+1: 0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE.
  const pips: Array<{ color: keyof typeof COLOR; face: number }> = [
    { color: 'brown', face: 4 },
    { color: 'purple', face: 6 },
    { color: 'green', face: 5 },
    { color: 'brown', face: 3 },
    { color: 'purple', face: 1 },
    { color: 'green', face: 2 },
  ];
  return (
    <svg width="100%" height={130} viewBox="0 0 330 125" style={{ display: 'block' }}>
      <polygon points={corners.map((c) => c.join(',')).join(' ')} fill="#7cb342" stroke="#e8d9a8" strokeWidth={3} />
      {corners.map((a, d) => {
        const b = corners[(d + 1) % 6]!;
        const pip = pips[d]!;
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        return (
          <g key={d}>
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={COLOR[pip.color]} strokeWidth={4} />
            <Pip x={cx + (mx - cx) * 0.72} y={cy + (my - cy) * 0.72} color={COLOR[pip.color]} face={pip.face} />
          </g>
        );
      })}
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#3b2f25">
        castle
      </text>
      <g fontSize={11} fill="currentColor">
        <Pip x={150} y={30} color={COLOR.purple} face={1} />
        <Pip x={168} y={30} color={COLOR.purple} face={6} />
        <text x={182} y={34}>purple: the "/" edges</text>
        <Pip x={150} y={60} color={COLOR.green} face={2} />
        <Pip x={168} y={60} color={COLOR.green} face={5} />
        <text x={182} y={64}>green: the "\" edges</text>
        <Pip x={150} y={90} color={COLOR.brown} face={3} />
        <Pip x={168} y={90} color={COLOR.brown} face={4} />
        <text x={182} y={94}>brown: the "|" edges</text>
      </g>
    </svg>
  );
}
