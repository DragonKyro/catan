import type { GameState, ImprovementTrack } from '@/game/types';
import { IMPROVEMENT_TRACKS } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';
import { TRACK_LABEL } from '@/game/modules/citiesAndKnights/constants';

interface Props {
  game: GameState;
}

// Track colours of the three metropolis pieces (p.3, p.8): science dark
// green, trade light green, politics blue-grey.
export const METROPOLIS_COLOR: Record<ImprovementTrack, string> = {
  science: '#2f7d3a',
  trade: '#9bcf4f',
  politics: '#9db4dc',
};

// Cities & Knights metropolises: the gate-shaped piece (two towers joined by
// an arch) set on top of the city it upgrades, in its track colour and
// rimmed in the owner's colour. A permanent one (first to level 5) carries a
// gold star.
export function MetropolisMarker({ game }: Props) {
  const mets = game.metropolises;
  if (!mets) return null;
  return (
    <g className="metropolis-markers" pointerEvents="none">
      {IMPROVEMENT_TRACKS.map((track) => {
        const m = mets[track];
        if (!m) return null;
        const v = game.board.vertices[m.vertex];
        const owner = game.players.find((p) => p.id === m.playerId);
        if (!v || !owner) return null;
        return (
          <g key={track} transform={`translate(${v.position.x}, ${v.position.y - 7})`}>
            <title>{`${TRACK_LABEL[track]} metropolis — ${owner.name}${m.permanent ? ' (permanent)' : ''}`}</title>
            <MetropolisGlyph
              fill={METROPOLIS_COLOR[track]}
              rim={playerColorVar(owner.color)}
              permanent={m.permanent}
            />
          </g>
        );
      })}
    </g>
  );
}

// Gate piece centred on (0, 0), ~18 wide × 18 tall.
export function MetropolisGlyph({
  fill,
  rim,
  permanent,
}: {
  fill: string;
  rim: string;
  permanent?: boolean;
}) {
  const d =
    'M-9,8 L-9,-7 L-10,-7 L-10,-10 L-4,-10 L-4,-7 L-5,-7 L-5,-1 ' +
    'Q0,-5 5,-1 L5,-7 L4,-7 L4,-10 L10,-10 L10,-7 L9,-7 L9,8 L4,8 L4,3 Q0,-0.5 -4,3 L-4,8 Z';
  return (
    <g>
      <path d={d} fill={rim} stroke={rim} strokeWidth={3.2} strokeLinejoin="round" />
      <path d={d} fill={fill} stroke="#151515" strokeWidth={0.9} strokeLinejoin="round" />
      {permanent && (
        <path
          d="M0,-15.5 L1.3,-12.6 L4.4,-12.4 L2,-10.4 L2.8,-7.4 L0,-9 L-2.8,-7.4 L-2,-10.4 L-4.4,-12.4 L-1.3,-12.6 Z"
          fill="#ffd54a"
          stroke="#5a4100"
          strokeWidth={0.6}
        />
      )}
    </g>
  );
}
