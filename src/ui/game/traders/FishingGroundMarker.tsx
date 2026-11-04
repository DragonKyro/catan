import type { BoardState, FishingGround } from '@/game/types';
import { numberPips } from '@/game/board/hexNumbers';

interface Props {
  board: BoardState;
  fg: FishingGround;
  // The fishing ground's number was just rolled: pulse like a producing hex.
  pulse?: boolean;
}

// Chevron depth (board units; a hex edge is 50).
const DEPTH = 32;

// T&B Fishing on Catan fishing-ground tile: a light-blue chevron on the sea
// frame, filling one of the six coastal "V" notches (its inner side lies
// against the two coastal edges, its three corners are the island corners
// that fish there), with its number disc at the tip.
export function FishingGroundMarker({ board, fg, pulse }: Props) {
  const pts = fg.vertices.map((v) => board.vertices[v]?.position);
  if (pts.length !== 3 || pts.some((p) => !p)) return null;
  const [o1, m, o2] = pts as Array<{ x: number; y: number }>;
  // The notch is a V opening out to sea with its tip at the middle corner:
  // outward is the V's bisector, and the outer side of the tile is the
  // coastline V pushed out by DEPTH.
  let ox = o1!.x - m!.x + (o2!.x - m!.x);
  let oy = o1!.y - m!.y + (o2!.y - m!.y);
  const mag = Math.hypot(ox, oy) || 1;
  ox /= mag;
  oy /= mag;
  const push = (p: { x: number; y: number }) => `${p.x + ox * DEPTH},${p.y + oy * DEPTH}`;
  const poly = [
    `${o1!.x},${o1!.y}`,
    `${m!.x},${m!.y}`,
    `${o2!.x},${o2!.y}`,
    push(o2!),
    push(m!),
    push(o1!),
  ].join(' ');
  const disc = { x: m!.x + ox * DEPTH * 0.55, y: m!.y + oy * DEPTH * 0.55 };
  const isHot = fg.token === 6 || fg.token === 8;
  const pips = numberPips(fg.token);
  // Little fish along each arm.
  const fishAt = (o: { x: number; y: number }) => ({
    x: (o.x + m!.x) / 2 + ox * DEPTH * 0.5,
    y: (o.y + m!.y) / 2 + oy * DEPTH * 0.5,
  });
  const angle = (Math.atan2(oy, ox) * 180) / Math.PI;
  return (
    <g
      className={`fishing-ground${pulse ? ' fishing-ground-pulse' : ''}`}
      pointerEvents="none"
    >
      <polygon
        points={poly}
        fill="#a6dde9"
        stroke="#4d9ab3"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      {[fishAt(o1!), fishAt(o2!)].map((p, i) => (
        <g key={i} transform={`translate(${p.x}, ${p.y}) rotate(${angle + (i ? -60 : 60)})`} opacity={0.75}>
          <path d="M-5,0 Q-2,-3 3,-1 Q5,0 3,1 Q-2,3 -5,0 Z" fill="#3c7f99" />
          <path d="M-5,0 L-8,-2.4 L-8,2.4 Z" fill="#3c7f99" />
        </g>
      ))}
      <g transform={`translate(${disc.x}, ${disc.y})`}>
        <circle r={11.5} fill="var(--token-fill)" stroke="#2f6f8a" strokeWidth={1.6} />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          y={-2}
          fontSize={11}
          fontWeight={700}
          fill={isHot ? 'var(--token-hot)' : '#1a1a1a'}
        >
          {fg.token}
        </text>
        <g transform="translate(0, 6)">
          {Array.from({ length: pips }).map((_, i) => (
            <circle
              key={i}
              cx={(i - (pips - 1) / 2) * 2.4}
              cy={0}
              r={0.85}
              fill={isHot ? 'var(--token-hot)' : '#1a1a1a'}
            />
          ))}
        </g>
      </g>
    </g>
  );
}
