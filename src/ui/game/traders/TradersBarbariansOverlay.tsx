import { useState } from 'react';
import { useGameStore, type UIMode } from '@/store/gameStore';
import type { EdgeId, GameState, PlayerColor, PlayerId } from '@/game/types';
import { totalResources } from '@/game/resources';
import {
  barbarianTargetEdges,
  driveOffTargets,
  legalWagonSteps,
  locationAtPlaza,
  roadOwner,
  wagonLevelInfo,
} from '@/game/modules/traders/tradersBarbarians/state';
import { BarbarianFigure } from './BarbarianAttackBoard';
import { PlayerWagonFigure } from './TradersBarbariansArt';
import { wagonSpot } from './TradersBarbariansBoard';

// Board click targets for the "Traders & Barbarians" scenario: the wagon's
// next steps (each with its MP cost, a coin where a toll is due) and the
// barbarians it can try to drive off during the End of Turn phase, and
// picking a barbarian + its new edge. Rendered by PlacementOverlay, which
// already limits it to the acting human seat (online: its own device).

export type TradersBarbariansMode = Extract<UIMode, { kind: 'tbWagon' | 'tbBarbarian' }>;

export function isTradersBarbariansMode(mode: UIMode): mode is TradersBarbariansMode {
  return mode.kind === 'tbWagon' || mode.kind === 'tbBarbarian';
}

function mid(game: GameState, edge: EdgeId) {
  const e = game.board.edges[edge]!;
  const a = game.board.vertices[e.vertices[0]]!.position;
  const b = game.board.vertices[e.vertices[1]]!.position;
  return { a, b, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function TradersBarbariansOverlay({
  game,
  acting,
  mode,
  color,
}: {
  game: GameState;
  acting: PlayerId;
  mode: TradersBarbariansMode;
  color: PlayerColor;
}) {
  const { dispatch, setMode } = useGameStore();
  const [hover, setHover] = useState<string | null>(null);
  const tb = game.tradersBarbarians;
  if (!tb) return null;

  if (mode.kind === 'tbWagon') {
    if (game.phase !== 'wagonMoves' || game.playerOrder[game.currentPlayerIndex] !== acting) return null;
    const wagon = tb.wagons[acting];
    if (!wagon) return null;
    const here = wagonSpot(game, wagon.vertex);
    const steps = legalWagonSteps(game, acting);
    const drive = driveOffTargets(game, acting);
    const min = wagonLevelInfo(wagon.level).driveOffMin;
    return (
      <g className="overlay tb-wagon-overlay">
        <circle cx={here.x} cy={here.y - 2} r={17} fill="none" stroke="#fff4c2" strokeWidth={2} strokeDasharray="4 3" pointerEvents="none" />
        {steps.map((s) => {
          const key = s.edge;
          const m = mid(game, s.edge);
          const to = game.board.vertices[s.to]!.position;
          const plaza = locationAtPlaza(game, s.to);
          const delivers = !!plaza && !!wagon.cargo && plaza.needs.includes(wagon.cargo.good);
          const hot = hover === key;
          const stroke = s.toll ? '#ffb74d' : s.mp >= 3 ? '#ff8a80' : s.mp === 1 ? '#b9f6ca' : '#fff4c2';
          const owner = s.toll ? game.players.find((p) => p.id === s.toll)?.name : null;
          return (
            <g
              key={key}
              className="ghost"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(key)}
              onMouseLeave={() => setHover(null)}
              onClick={() => dispatch({ type: 'moveWagon', playerId: acting, to: s.to })}
            >
              <title>
                {`${s.mp} MP${owner ? ` + 1 gold to ${owner}` : ''}${plaza ? ` — ends the move at the ${plaza.id}${delivers ? ' (delivers your token)' : ''}` : ''}`}
              </title>
              <line x1={m.a.x} y1={m.a.y} x2={m.b.x} y2={m.b.y} stroke="transparent" strokeWidth={16} />
              <line
                x1={m.a.x}
                y1={m.a.y}
                x2={m.b.x}
                y2={m.b.y}
                stroke={stroke}
                strokeOpacity={hot ? 1 : 0.85}
                strokeWidth={hot ? 4.5 : 3.2}
                strokeDasharray="5 3"
                strokeLinecap="round"
              />
              <circle
                cx={to.x}
                cy={to.y}
                r={hot ? 10 : 8}
                fill={delivers ? '#2e7d32' : '#000'}
                fillOpacity={delivers ? 0.55 : 0.22}
                stroke={stroke}
                strokeWidth={2.2}
              />
              {hot && (
                <g transform={`translate(${to.x}, ${to.y})`} pointerEvents="none">
                  <PlayerWagonFigure color={color} ghost scale={0.8} />
                </g>
              )}
              <g transform={`translate(${m.x}, ${m.y})`} pointerEvents="none">
                <rect x={s.toll ? -11 : -7} y={-6.5} width={s.toll ? 22 : 14} height={13} rx={6.5} fill="#1f2933" stroke={stroke} strokeWidth={1.2} />
                <text x={s.toll ? -4 : 0} y={3.4} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff">
                  {s.mp}
                </text>
                {s.toll && (
                  <g transform="translate(5.5, 0)">
                    <circle r={4.2} fill="#e9b73c" stroke="#8a5d0e" strokeWidth={0.8} />
                    <text y={2.6} textAnchor="middle" fontSize={6} fontWeight={800} fill="#8a5d0e">
                      1
                    </text>
                  </g>
                )}
              </g>
              {delivers && (
                <text x={to.x} y={to.y + 3.5} textAnchor="middle" fontSize={10} fontWeight={900} fill="#fff" pointerEvents="none">
                  ✓
                </text>
              )}
            </g>
          );
        })}
        {drive.map((i) => {
          const m = mid(game, tb.barbarians[i]!);
          const key = `b${i}`;
          return (
            <g
              key={key}
              className="ghost"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(key)}
              onMouseLeave={() => setHover(null)}
              onClick={() => dispatch({ type: 'driveOffBarbarian', playerId: acting, barbarian: i })}
            >
              <title>{`Try to drive off this barbarian: roll ${min}${min === 6 ? '' : '–6'} on one die`}</title>
              <circle
                cx={m.x}
                cy={m.y - 5}
                r={15}
                fill="#ff5252"
                fillOpacity={hover === key ? 0.3 : 0.12}
                stroke="#ff8a80"
                strokeWidth={2.2}
                strokeDasharray="4 3"
              />
              <g transform={`translate(${m.x + 13}, ${m.y - 18})`} pointerEvents="none">
                <rect x={-10} y={-6.5} width={20} height={13} rx={4} fill="#fffbea" stroke="#b71c1c" strokeWidth={1.1} />
                <text y={3.4} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="#b71c1c">
                  🎲{min}+
                </text>
              </g>
            </g>
          );
        })}
      </g>
    );
  }

  // Placing a barbarian.
  const pending = tb.pendingBarbarian;
  if (game.phase !== 'moveBarbarian' || !pending || pending.playerId !== acting) return null;
  const fixed = pending.barbarian;
  const pick = fixed ?? mode.pick;
  if (pick === undefined) {
    return (
      <g className="overlay tb-barbarian-pick">
        {tb.barbarians.map((edge, i) => {
          const m = mid(game, edge);
          const key = `p${i}`;
          return (
            <g
              key={key}
              className="ghost"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(key)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setMode({ kind: 'tbBarbarian', pick: i })}
            >
              <title>Move this barbarian</title>
              <circle
                cx={m.x}
                cy={m.y - 5}
                r={15}
                fill="#ffd97e"
                fillOpacity={hover === key ? 0.35 : 0.12}
                stroke="#ffd97e"
                strokeWidth={2.4}
                strokeDasharray="4 3"
              />
            </g>
          );
        })}
      </g>
    );
  }
  const from = mid(game, tb.barbarians[pick]!);
  const robs = pending.reason !== 'driveOff';
  return (
    <g className="overlay tb-barbarian-place">
      <g
        style={{ cursor: fixed === undefined ? 'pointer' : undefined }}
        onClick={fixed === undefined ? () => setMode({ kind: 'tbBarbarian' }) : undefined}
      >
        {fixed === undefined && <title>Pick another barbarian</title>}
        <circle cx={from.x} cy={from.y - 5} r={15} fill="#ffffff" fillOpacity={0.25} stroke="#fff" strokeWidth={2.4} />
      </g>
      {barbarianTargetEdges(game).map((edge) => {
        const m = mid(game, edge);
        const owner = robs ? roadOwner(game, edge) : null;
        const victim = owner && owner !== acting ? game.players.find((p) => p.id === owner) : undefined;
        const steal = !!victim && totalResources(victim.resources) > 0;
        const hot = hover === edge;
        return (
          <g
            key={edge}
            className="ghost"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHover(edge)}
            onMouseLeave={() => setHover(null)}
            onClick={() => dispatch({ type: 'moveTbBarbarian', playerId: acting, barbarian: pick, edge })}
          >
            {steal && <title>{`Rob ${victim!.name}: 1 random resource card`}</title>}
            <line x1={m.a.x} y1={m.a.y} x2={m.b.x} y2={m.b.y} stroke="transparent" strokeWidth={14} />
            <line
              x1={m.a.x}
              y1={m.a.y}
              x2={m.b.x}
              y2={m.b.y}
              stroke={steal ? '#ff8a80' : '#ffd97e'}
              strokeOpacity={hot ? 0.95 : steal ? 0.85 : 0.5}
              strokeWidth={hot ? 4 : 2.4}
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
            {steal && !hot && (
              <text x={m.x} y={m.y + 3} textAnchor="middle" fontSize={9} pointerEvents="none">
                💰
              </text>
            )}
            {hot && (
              <g opacity={0.75} pointerEvents="none">
                <BarbarianFigure x={m.x} y={m.y - 5} scale={1.45} />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
