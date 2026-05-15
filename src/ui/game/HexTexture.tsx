import { useMemo } from 'react';
import type { Hex } from '@/game/types';

// Each terrain gets a small, low-contrast motif scattered randomly across
// its hex. The motifs are seeded by hex.id so they stay the same across
// re-renders / actions and feel like an inherent part of that tile rather
// than animated noise.
//
// Motifs are kept tiny and translucent — the goal is "lived-in", not
// "decorative". Number tokens, pieces, and ports must remain the focal
// elements.

const MOTIF_COUNT = 5;
const SAFE_RADIUS = 24; // < hex size (50) so motifs stay inside the polygon

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function makeRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Props {
  hex: Hex;
}

export function HexTexture({ hex }: Props) {
  const motifs = useMemo(() => {
    const rand = makeRand(hashStr(hex.id));
    const out: { x: number; y: number; scale: number; rot: number; key: number }[] = [];
    // Reject-sample positions that fall too close to the center (where the
    // number token sits) so we don't visually crowd the most important UI.
    const tokenRadius = hex.numberToken !== null ? 19 : 0;
    let safety = 0;
    while (out.length < MOTIF_COUNT && safety < 40) {
      safety++;
      const r = SAFE_RADIUS * Math.sqrt(rand());
      const theta = rand() * Math.PI * 2;
      const dx = Math.cos(theta) * r;
      const dy = Math.sin(theta) * r;
      if (Math.hypot(dx, dy) < tokenRadius + 4) continue;
      out.push({
        x: hex.center.x + dx,
        y: hex.center.y + dy,
        scale: 0.8 + rand() * 0.5,
        rot: (rand() - 0.5) * 36,
        key: out.length,
      });
    }
    return out;
  }, [hex.id, hex.center.x, hex.center.y, hex.numberToken]);

  if (hex.terrain === 'desert') {
    // Desert gets a softer treatment — just a few tiny dunes/dots.
    return (
      <g className="hex-texture" pointerEvents="none">
        {motifs.map((m) => (
          <ellipse
            key={m.key}
            cx={m.x}
            cy={m.y}
            rx={2.4 * m.scale}
            ry={0.8 * m.scale}
            fill="#a4895a"
            opacity={0.35}
          />
        ))}
      </g>
    );
  }

  return (
    <g className="hex-texture" pointerEvents="none">
      {motifs.map((m) => (
        <g
          key={m.key}
          transform={`translate(${m.x}, ${m.y}) rotate(${m.rot}) scale(${m.scale})`}
        >
          <Glyph terrain={hex.terrain} />
        </g>
      ))}
    </g>
  );
}

function Glyph({ terrain }: { terrain: string }) {
  switch (terrain) {
    case 'wood':
      // Tiny pine silhouette: triangle + trunk.
      return (
        <g opacity={0.45}>
          <path d="M0,-4 L2.6,2 L-2.6,2 Z" fill="#1d3f24" />
          <rect x={-0.5} y={2} width={1} height={1.4} fill="#3a2418" />
        </g>
      );
    case 'brick':
      // Small staggered brick block.
      return (
        <g opacity={0.5}>
          <rect x={-2.6} y={-1.4} width={2.4} height={1.2} rx={0.2} fill="#7a3318" />
          <rect x={0.2} y={-1.4} width={2.4} height={1.2} rx={0.2} fill="#7a3318" />
          <rect x={-1.4} y={0.2} width={2.8} height={1.2} rx={0.2} fill="#7a3318" />
        </g>
      );
    case 'sheep':
      // Wool tuft — 3 overlapping circles.
      return (
        <g opacity={0.5} fill="#fdfbf3" stroke="#3a4a25" strokeWidth={0.3}>
          <circle cx={-1.6} cy={0.2} r={1.4} />
          <circle cx={1.3} cy={-0.8} r={1.4} />
          <circle cx={0.8} cy={1.6} r={1.4} />
        </g>
      );
    case 'wheat':
      // Wheat stalk: vertical line + grain barbs.
      return (
        <g
          opacity={0.55}
          stroke="#7a5610"
          strokeWidth={0.5}
          strokeLinecap="round"
          fill="none"
        >
          <line x1={0} y1={-3} x2={0} y2={3} />
          <line x1={0} y1={-1.6} x2={1.3} y2={-2.3} />
          <line x1={0} y1={-1.6} x2={-1.3} y2={-2.3} />
          <line x1={0} y1={0} x2={1.3} y2={-0.7} />
          <line x1={0} y1={0} x2={-1.3} y2={-0.7} />
          <line x1={0} y1={1.6} x2={1.3} y2={0.9} />
          <line x1={0} y1={1.6} x2={-1.3} y2={0.9} />
        </g>
      );
    case 'ore':
      // Faceted rock chunk.
      return (
        <g opacity={0.45}>
          <path
            d="M-2.4,1.2 L-0.8,-2.2 L1.4,-2 L2.6,0.4 L1,2 L-1.6,1.6 Z"
            fill="#3f3f47"
            stroke="#212126"
            strokeWidth={0.4}
          />
          <path
            d="M-0.8,-2.2 L1.4,-2 L0.2,0.2 Z"
            fill="#5a5a64"
          />
        </g>
      );
    case 'sea':
      // Wave glyph.
      return (
        <g
          opacity={0.45}
          stroke="#cfe5ff"
          strokeWidth={0.55}
          strokeLinecap="round"
          fill="none"
        >
          <path d="M-3,0 Q-1.5,-1.4 0,0 T3,0" />
          <path d="M-3,2 Q-1.5,0.6 0,2 T3,2" opacity={0.6} />
        </g>
      );
    case 'gold':
      // Sparkle / coin glyph.
      return (
        <g opacity={0.55}>
          <circle r={1.6} fill="#fff3a8" stroke="#a07a14" strokeWidth={0.4} />
          <path
            d="M0,-2.4 L0.5,-0.5 L2.4,0 L0.5,0.5 L0,2.4 L-0.5,0.5 L-2.4,0 L-0.5,-0.5 Z"
            fill="#fff0b0"
            opacity={0.55}
          />
        </g>
      );
    default:
      return null;
  }
}
