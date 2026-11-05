import type { GameState, HexId } from '@/game/types';
import { wateringHoles } from '@/game/modules/traders/merchantTrains/trains';

interface Props {
  game: GameState;
}

// Merchant Trains: the watering hole hex art — two ponds with a hut and a
// fence, like the rulebook tile — plus its three train start points. Each
// start corner (NW, NE, S) gets a green disc with an arrow along the edge a
// new train's first wagon takes (away from the hex); the other three
// corners are marked with a small red cross (no train starts there). At 5-6
// players there are two watering holes, three starts each.
export function WateringHoleMarker({ game }: Props) {
  const holes = wateringHoles(game);
  if (holes.length === 0) return null;
  return (
    <>
      {holes.map((hexId) => (
        <OneWateringHole key={hexId} game={game} hexId={hexId} />
      ))}
    </>
  );
}

function OneWateringHole({ game, hexId }: Props & { hexId: HexId }) {
  const board = game.board;
  const hex = board.hexes[hexId];
  if (!hex) return null;
  const starts = (game.wagonStarts ?? []).filter((s) => hex.corners.includes(s.corner));
  const startCorners = new Set(starts.map((s) => s.corner));
  const { x: cx, y: cy } = hex.center;
  return (
    <g className="watering-hole" pointerEvents="none">
      <g transform={`translate(${cx}, ${cy})`}>
        {/* ponds */}
        <path d="M-21,-6 q4,-7 13,-4 q6,3 1,8 q-7,5 -13,1 q-4,-2 -1,-5 z" fill="#5fb7d6" stroke="#2f7896" strokeWidth={0.9} />
        <path d="M6,9 q5,-6 13,-3 q4,3 0,7 q-6,4 -12,1 q-3,-2 -1,-5 z" fill="#5fb7d6" stroke="#2f7896" strokeWidth={0.9} />
        <path d="M-17,-5 q3,-2 6,-1" stroke="#cdeff9" strokeWidth={0.9} fill="none" strokeLinecap="round" />
        <path d="M9,9 q3,-2 6,-1" stroke="#cdeff9" strokeWidth={0.9} fill="none" strokeLinecap="round" />
        {/* hut */}
        <rect x={5} y={-16} width={11} height={7} fill="#8a5a2b" stroke="#4a2f14" strokeWidth={0.8} />
        <path d="M3.5,-16 L10.5,-21 L17.5,-16 Z" fill="#6b3f1a" stroke="#4a2f14" strokeWidth={0.8} />
        <rect x={9} y={-13.5} width={3} height={4.5} fill="#3a2410" />
        {/* fence */}
        <path d="M-14,12 H-1 M-14,15 H-1 M-13,10 V17 M-9,10 V17 M-5,10 V17 M-1,10 V17" stroke="#6b4a26" strokeWidth={0.9} />
        {/* grass tufts */}
        <path d="M-4,-1 l1,-3 l1,3 l1,-2.4 l1,2.4" stroke="#4f7d32" strokeWidth={0.8} fill="none" />
        <path d="M14,-3 l1,-3 l1,3 l1,-2.4 l1,2.4" stroke="#4f7d32" strokeWidth={0.8} fill="none" />
      </g>
      {hex.corners.map((vid) => {
        const v = board.vertices[vid];
        if (!v) return null;
        if (startCorners.has(vid)) return null;
        const { x, y } = v.position;
        const ix = x + (cx - x) * 0.2;
        const iy = y + (cy - y) * 0.2;
        return (
          <g key={vid} transform={`translate(${ix}, ${iy})`} opacity={0.85}>
            <circle r={4.2} fill="#a3262a" stroke="#fff" strokeWidth={0.9} />
            <path d="M-1.8,-1.8 L1.8,1.8 M1.8,-1.8 L-1.8,1.8" stroke="#fff" strokeWidth={1.2} strokeLinecap="round" />
          </g>
        );
      })}
      {starts.map((s) => {
        const c = board.vertices[s.corner]?.position;
        const h = board.vertices[s.head]?.position;
        if (!c || !h) return null;
        const angle = (Math.atan2(h.y - c.y, h.x - c.x) * 180) / Math.PI;
        // Sit just inside the hex at the corner.
        const ix = c.x + (cx - c.x) * 0.22;
        const iy = c.y + (cy - c.y) * 0.22;
        return (
          <g key={s.corner} transform={`translate(${ix}, ${iy})`}>
            <circle r={5.6} fill="#2f8f46" stroke="#fff" strokeWidth={1.1} />
            <g transform={`rotate(${angle})`}>
              <path d="M-2.8,0 H2.2 M0.4,-2.2 L2.8,0 L0.4,2.2" stroke="#fff" strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
        );
      })}
    </g>
  );
}
