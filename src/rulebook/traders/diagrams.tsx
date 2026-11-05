// Inline SVG diagrams for the Rivers of Catan / Fishing on Catan rulebook
// topics. Same small, low-contrast style as the other rulebook diagrams.

const S = 14; // hex circumradius in the diagram
const W = Math.sqrt(3) * S;

// Centre of axial hex (q, r), pointy-top.
function centre(q: number, r: number, ox: number, oy: number): [number, number] {
  return [ox + W * (q + r / 2), oy + 1.5 * S * r];
}

function hexPoints(cx: number, cy: number, s = S): string {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = ((60 * k - 90) * Math.PI) / 180;
    pts.push(`${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

const ISLAND: Array<[number, number]> = [];
for (let r = -2; r <= 2; r++) {
  for (let q = -2; q <= 2; q++) if (Math.abs(q + r) <= 2) ISLAND.push([q, r]);
}

const RIVER_TERRAIN: Record<string, string> = {
  '-1,-1': '#8b8b93',
  '-1,0': '#c8693a',
  '-1,1': '#a6d06a',
  '-1,2': '#59733e',
  '1,-1': '#8b8b93',
  '1,0': '#c8693a',
  '1,1': '#59733e',
};

// The Rivers of Catan board: the two fixed river tiles (mountains → hills
// (→ pasture) → swamp) with the river drawn through them and the seven
// bridge sites ticked.
export function RiverTilesDiagram() {
  const ox = 120;
  const oy = 62;
  const rivers: Array<Array<[number, number]>> = [
    [[-1, -1], [-1, 0], [-1, 1], [-1, 2]],
    [[1, -1], [1, 0], [1, 1]],
  ];
  const mouthDir: Array<[number, number]> = [[-0.5, 0.87], [1, 0]];
  return (
    <svg className="rb-diagram" width="100%" height={140} viewBox="0 0 240 140" style={{ display: 'block' }}>
      <rect width="240" height="140" fill="#2a5a8a" rx="6" />
      {ISLAND.map(([q, r]) => {
        const [x, y] = centre(q, r, ox, oy);
        return (
          <polygon
            key={`${q},${r}`}
            points={hexPoints(x, y)}
            fill={RIVER_TERRAIN[`${q},${r}`] ?? '#efe6c8'}
            stroke="#1a1a1a40"
            strokeWidth={1}
          />
        );
      })}
      {rivers.map((hexes, i) => {
        const pts = hexes.map(([q, r]) => centre(q, r, ox, oy));
        const [lx, ly] = pts[pts.length - 1]!;
        const [mx, my] = mouthDir[i]!;
        const path = [
          `M${pts[0]![0] - 3},${pts[0]![1] - 8}`,
          ...pts.map(([x, y]) => `L${x},${y}`),
          `L${lx + mx * (S + 6)},${ly + my * (S + 6)}`,
        ].join(' ');
        const sites: Array<[number, number]> = [];
        for (let k = 0; k + 1 < pts.length; k++) {
          sites.push([(pts[k]![0] + pts[k + 1]![0]) / 2, (pts[k]![1] + pts[k + 1]![1]) / 2]);
        }
        sites.push([lx + mx * S * 0.87, ly + my * S * 0.87]);
        return (
          <g key={i}>
            <path d={path} fill="none" stroke="#2f6f93" strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round" />
            <path d={path} fill="none" stroke="#69c1e6" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
            {sites.map(([x, y], k) => (
              <circle key={k} cx={x} cy={y} r={3.2} fill="#f4ead2" stroke="#1a1a1a" strokeWidth={0.8} />
            ))}
          </g>
        );
      })}
      <text x="8" y="132" fontSize="9" fill="#cfe5ff">
        ○ bridge site · river tiles pay gold on every corner and edge
      </text>
    </svg>
  );
}

// Fishing on Catan: a fishing-ground tile in its coastal notch, and the
// lake with its four printed numbers.
export function FishingDiagram() {
  // Two land hexes meeting at the notch, sea above.
  const left: [number, number] = [86, 78];
  const right: [number, number] = [86 + W * 2, 78];
  const o1: [number, number] = [left[0], left[1] - 2 * S];
  const m: [number, number] = [left[0] + W, left[1] - S];
  const o2: [number, number] = [right[0], right[1] - 2 * S];
  const d = 16;
  const chevron = [o1, m, o2, [o2[0], o2[1] - d], [m[0], m[1] - d], [o1[0], o1[1] - d]]
    .map(([x, y]) => `${x},${y}`)
    .join(' ');
  return (
    <svg className="rb-diagram" width="100%" height={120} viewBox="0 0 240 120" style={{ display: 'block' }}>
      <rect width="240" height="120" fill="#2a5a8a" rx="6" />
      <polygon points={hexPoints(left[0], left[1], S * 2)} fill="#efe6c8" stroke="#1a1a1a40" />
      <polygon points={hexPoints(right[0], right[1], S * 2)} fill="#efe6c8" stroke="#1a1a1a40" />
      <polygon points={chevron} fill="#a6dde9" stroke="#4d9ab3" strokeWidth={1.2} />
      <circle cx={m[0]} cy={m[1] - d * 0.55} r={6.5} fill="#f7f1d8" stroke="#2f6f8a" />
      <text x={m[0]} y={m[1] - d * 0.55 + 3} textAnchor="middle" fontSize="8" fontWeight="700">
        9
      </text>
      {[o1, m, o2].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="#d94545" stroke="#1a1a1a" strokeWidth={0.8} />
      ))}
      <g transform="translate(200, 64)">
        <polygon points={hexPoints(0, 0, 26)} fill="#7fa35a" stroke="#1a1a1a40" />
        <ellipse rx={19} ry={18} fill="#2f80ad" stroke="#e8f6fb" />
        {[
          [-7, -6, 11],
          [7, -6, 12],
          [-7, 7, 2],
          [7, 7, 3],
        ].map(([x, y, n]) => (
          <g key={n}>
            <circle cx={x} cy={y} r={5.6} fill="#f7f1d8" stroke="#4a3a25" strokeWidth={0.6} />
            <text x={x} y={y! + 2.5} textAnchor="middle" fontSize="6.5" fontWeight="700">
              {n}
            </text>
          </g>
        ))}
      </g>
      <text x="8" y="112" fontSize="9" fill="#cfe5ff">
        ● the 3 corners that fish · the lake fishes on 2, 3, 11, 12
      </text>
    </svg>
  );
}
