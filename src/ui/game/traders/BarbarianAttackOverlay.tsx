import { useState } from 'react';
import { useGameStore, type UIMode } from '@/store/gameStore';
import type { EdgeId, GameState, HexId, PlayerColor, PlayerId } from '@/game/types';
import {
  captureHexes,
  cardKnightEdges,
  previewTreason,
  treasonCanContinue,
  treasonDestinations,
  treasonSources,
} from '@/game/modules/traders/barbarianAttack/cards';
import {
  isCastleEdge,
  knightMoveTargets,
  movableKnights,
} from '@/game/modules/traders/barbarianAttack/knights';
import { KnightFigure } from './BarbarianAttackBoard';

// Board click targets for Barbarian Attack: the choice for a card just bought
// (a Capture hex, a Knighthood / Swift Knight edge), Treason's barbarian
// moves, and the end-of-turn knight moves. Rendered by PlacementOverlay,
// which already limits it to the acting human seat (online: its own device).

export type BarbarianAttackMode = Extract<UIMode, { kind: 'baCard' | 'baTreason' | 'baKnightMove' }>;

export function isBarbarianAttackMode(mode: UIMode): mode is BarbarianAttackMode {
  return mode.kind === 'baCard' || mode.kind === 'baTreason' || mode.kind === 'baKnightMove';
}

// Treason: where the next pick comes from. A null `from` (supply) is picked
// automatically when no coastal hex can give a barbarian.
export function treasonStep(game: GameState, mode: Extract<UIMode, { kind: 'baTreason' }>) {
  const sources = mode.moves.map((m) => m.from).filter((h): h is HexId => h !== null);
  const dests = mode.moves.map((m) => m.to);
  const preview = previewTreason(game, mode.moves);
  const options = treasonSources(preview, sources, dests);
  const from =
    mode.from !== undefined ? mode.from : options.length === 1 && options[0] === null ? null : undefined;
  return { preview, sources, dests, options, from };
}

export function BarbarianAttackOverlay({
  game,
  acting,
  mode,
  color,
}: {
  game: GameState;
  acting: PlayerId;
  mode: BarbarianAttackMode;
  color: PlayerColor;
}) {
  const { dispatch, setMode } = useGameStore();
  const [hover, setHover] = useState<string | null>(null);
  const ba = game.barbarianAttack;
  if (!ba) return null;

  if (mode.kind === 'baCard') {
    const pending = ba.pendingCard;
    if (game.phase !== 'barbarianCard' || !pending || pending.playerId !== acting) return null;
    if (pending.card === 'capture') {
      return (
        <g className="overlay overlay-hexes">
          {captureHexes(game).map((h) => (
            <HexTarget
              key={h}
              game={game}
              hex={h}
              label="⛓"
              onClick={() => dispatch({ type: 'resolveBarbarianCard', playerId: acting, hex: h })}
            />
          ))}
        </g>
      );
    }
    return (
      <g className="overlay overlay-edges">
        {cardKnightEdges(game, pending.card).map((e) => (
          <EdgeTarget
            key={e}
            game={game}
            edge={e}
            color={color}
            hovered={hover === e}
            onHover={(h) => setHover(h ? e : null)}
            onClick={() => dispatch({ type: 'resolveBarbarianCard', playerId: acting, edge: e })}
          />
        ))}
      </g>
    );
  }

  if (mode.kind === 'baTreason') {
    if (game.phase !== 'barbarianCard' || ba.pendingCard?.playerId !== acting) return null;
    const step = treasonStep(game, mode);
    if (step.from === undefined) {
      return (
        <g className="overlay overlay-hexes">
          {step.options.map((h) =>
            h === null ? null : (
              <HexTarget
                key={h}
                game={game}
                hex={h}
                label="↑"
                onClick={() => setMode({ kind: 'baTreason', moves: mode.moves, from: h })}
              />
            ),
          )}
        </g>
      );
    }
    const from = step.from;
    const srcs = from ? [...step.sources, from] : step.sources;
    return (
      <g className="overlay overlay-hexes">
        {from && <HexTarget game={game} hex={from} label="↑" selected onClick={() => setMode({ kind: 'baTreason', moves: mode.moves })} />}
        {treasonDestinations(step.preview, srcs, step.dests).map((h) => (
          <HexTarget
            key={h}
            game={game}
            hex={h}
            label="↓"
            onClick={() => {
              const moves = [...mode.moves, { from, to: h }];
              if (treasonCanContinue(game, moves)) setMode({ kind: 'baTreason', moves });
              else dispatch({ type: 'resolveBarbarianCard', playerId: acting, moves });
            }}
          />
        ))}
      </g>
    );
  }

  // End-of-turn knight moves.
  if (game.phase !== 'barbarianKnightMoves') return null;
  if (!mode.from) {
    return (
      <g className="overlay overlay-edges">
        {movableKnights(game, acting).map((e) => (
          <KnightPick
            key={e}
            game={game}
            edge={e}
            mustMove={isCastleEdge(game, e)}
            onClick={() => setMode({ kind: 'baKnightMove', from: e })}
          />
        ))}
      </g>
    );
  }
  const from = mode.from;
  const hasWheat = (game.players.find((p) => p.id === acting)?.resources.wheat ?? 0) > 0;
  return (
    <g className="overlay overlay-edges">
      <KnightPick game={game} edge={from} selected mustMove={false} onClick={() => setMode({ kind: 'baKnightMove' })} />
      {knightMoveTargets(game, from)
        .filter((t) => !t.boost || hasWheat)
        .map((t) => (
          <EdgeTarget
            key={t.edge}
            game={game}
            edge={t.edge}
            color={color}
            boost={t.boost}
            hovered={hover === t.edge}
            onHover={(h) => setHover(h ? t.edge : null)}
            onClick={() =>
              dispatch({
                type: 'moveBarbarianKnight',
                playerId: acting,
                from,
                to: t.edge,
                ...(t.boost ? { boost: true } : {}),
              })
            }
          />
        ))}
    </g>
  );
}

function HexTarget({
  game,
  hex,
  label,
  selected,
  onClick,
}: {
  game: GameState;
  hex: HexId;
  label: string;
  selected?: boolean;
  onClick: () => void;
}) {
  const c = game.board.hexes[hex]!.center;
  return (
    <g style={{ cursor: 'pointer' }} onClick={onClick} className="ghost">
      <circle
        cx={c.x}
        cy={c.y}
        r={30}
        fill={selected ? '#ffd97e' : '#000'}
        fillOpacity={selected ? 0.28 : 0.15}
        stroke="#ffd97e"
        strokeOpacity={0.95}
        strokeDasharray={selected ? undefined : '5 3'}
        strokeWidth={2.5}
      />
      <text
        x={c.x + 22}
        y={c.y - 20}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={13}
        fontWeight={700}
        fill="#fff8e1"
        stroke="#3b2a12"
        strokeWidth={2.5}
        paintOrder="stroke fill"
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}

// A destination / placement edge. Boosted (4-5 edge) moves are amber and
// carry a wheat mark: they cost 1 wheat.
function EdgeTarget({
  game,
  edge,
  color,
  boost,
  hovered,
  onHover,
  onClick,
}: {
  game: GameState;
  edge: EdgeId;
  color: PlayerColor;
  boost?: boolean;
  hovered: boolean;
  onHover: (h: boolean) => void;
  onClick: () => void;
}) {
  const e = game.board.edges[edge]!;
  const a = game.board.vertices[e.vertices[0]]!.position;
  const b = game.board.vertices[e.vertices[1]]!.position;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const stroke = boost ? '#ffb74d' : '#ffd97e';
  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className="ghost"
    >
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={18} />
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={stroke}
        strokeOpacity={hovered ? 0.35 : 0.9}
        strokeWidth={3.5}
        strokeDasharray={boost ? '2 3' : '6 4'}
        strokeLinecap="round"
      />
      {hovered ? (
        <g opacity={0.75}>
          <KnightFigure x={mx} y={my} color={color} />
        </g>
      ) : (
        boost && (
          <text x={mx} y={my} textAnchor="middle" dominantBaseline="central" fontSize={9} pointerEvents="none">
            🌾
          </text>
        )
      )}
    </g>
  );
}

// Ring around one of your knights that can still move (red = on a castle
// edge, must move).
function KnightPick({
  game,
  edge,
  mustMove,
  selected,
  onClick,
}: {
  game: GameState;
  edge: EdgeId;
  mustMove: boolean;
  selected?: boolean;
  onClick: () => void;
}) {
  const e = game.board.edges[edge]!;
  const a = game.board.vertices[e.vertices[0]]!.position;
  const b = game.board.vertices[e.vertices[1]]!.position;
  const stroke = selected ? '#ffffff' : mustMove ? '#ff5252' : '#ffd97e';
  return (
    <g style={{ cursor: 'pointer' }} onClick={onClick} className="ghost">
      <circle
        cx={(a.x + b.x) / 2}
        cy={(a.y + b.y) / 2 - 2}
        r={12}
        fill={selected ? '#ffffff' : '#000'}
        fillOpacity={selected ? 0.25 : 0.08}
        stroke={stroke}
        strokeWidth={2.4}
        strokeDasharray={selected ? undefined : '4 3'}
      />
    </g>
  );
}
