import type { GameState, PlayerColor, TribeToken, VertexId } from '@/game/types';
import { getPortMarkerPosition } from '../boardLayout';
import { PLAYER_COLOR_HEX } from '@/ui/shared/playerColors';
import { RESOURCE_ICON } from '@/ui/shared/ResourceChip';

interface Props {
  game: GameState;
}

// Board markers for the Seafarers scenarios: Forgotten Tribe pickups,
// Cloth for Catan villages, Wonders of Catan marker intersections, and the
// Pirate Islands fleet loop, fortresses and beachheads. Purely decorative —
// pointer events are off so the placement overlay underneath stays
// clickable.
export function ScenarioMarkers({ game }: Props) {
  return (
    <g className="scenario-markers" pointerEvents="none">
      <PirateLoop game={game} />
      <WonderSites game={game} />
      <TribePickups game={game} />
      <Villages game={game} />
      <Fortresses game={game} />
    </g>
  );
}

function colorOf(game: GameState, playerId: string | null | undefined): PlayerColor | null {
  if (!playerId) return null;
  return game.players.find((p) => p.id === playerId)?.color ?? null;
}

function vertexPos(game: GameState, v: VertexId) {
  return game.board.vertices[v]!.position;
}

function tribeLabel(t: TribeToken): string {
  if (t.type === 'victoryPoint') return '★';
  if (t.type === 'devCard') return '🂠';
  if (!t.portType || t.portType === 'generic') return '3:1';
  return RESOURCE_ICON[t.portType];
}

function TribePickups({ game }: Props) {
  if (!game.tribeTokens) return null;
  return (
    <g className="tribe-pickups">
      {game.tribeTokens
        .filter((t) => t.claimedBy === null)
        .map((t) => {
          const p = getPortMarkerPosition(game.board, t.edge, 13);
          const fill =
            t.type === 'victoryPoint' ? '#b3261e' : t.type === 'devCard' ? '#c75b39' : '#e8f1f8';
          const ink = t.type === 'port' ? '#1a1a1a' : '#fff7e6';
          return (
            <g key={t.edge} transform={`translate(${p.x}, ${p.y})`}>
              <title>
                {t.type === 'victoryPoint'
                  ? 'Tribe VP token: a ship on this edge takes it (+1 VP)'
                  : t.type === 'devCard'
                    ? 'Face-down development card: a ship on this edge takes it'
                    : 'Tribe port: a ship on this edge takes it to place by a coastal settlement'}
              </title>
              {t.type === 'devCard' ? (
                <rect x={-6} y={-8} width={12} height={16} rx={2} fill={fill} stroke="#1a1a1a" strokeWidth={1} />
              ) : (
                <circle r={8.5} fill={fill} stroke="#1a1a1a" strokeWidth={1} />
              )}
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={t.type === 'port' && t.portType === 'generic' ? 6.5 : 9}
                fontWeight={700}
                fill={ink}
              >
                {tribeLabel(t)}
              </text>
            </g>
          );
        })}
    </g>
  );
}

function Villages({ game }: Props) {
  if (!game.clothVillages) return null;
  return (
    <g className="cloth-villages">
      {game.clothVillages.map((v) => {
        const { x, y } = vertexPos(game, v.vertex);
        const red = v.number === 6 || v.number === 8;
        const empty = v.supply <= 0;
        return (
          <g key={v.vertex} transform={`translate(${x}, ${y})`} opacity={empty ? 0.45 : 1}>
            <title>
              {`Village ${v.number}: ${v.supply} cloth left` +
                (v.partners.length
                  ? ` · trading with ${v.partners
                      .map((pid) => game.players.find((p) => p.id === pid)?.name ?? pid)
                      .join(', ')}`
                  : ' · no trade routes yet')}
            </title>
            <circle r={9.5} fill="#f4e7c3" stroke="#6b4f1d" strokeWidth={1.3} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={8.5}
              fontWeight={700}
              fill={red ? '#b3261e' : '#1a1a1a'}
            >
              {v.number}
            </text>
            {/* Cloth left next to the village. */}
            <g transform="translate(9, -8)">
              <rect x={-5} y={-4} width={10} height={8} rx={1.5} fill="#e9c46a" stroke="#6b4f1d" strokeWidth={0.8} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={6} fontWeight={700} fill="#1a1a1a">
                {v.supply}
              </text>
            </g>
            {/* One dot per trading partner. */}
            {v.partners.map((pid, i) => {
              const c = colorOf(game, pid);
              return (
                <circle
                  key={pid}
                  cx={-8 + i * 5}
                  cy={11}
                  r={2.3}
                  fill={c ? PLAYER_COLOR_HEX[c] : '#888'}
                  stroke="#1a1a1a"
                  strokeWidth={0.6}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

const SITE_ICON: Record<string, { icon: string; title: string }> = {
  greatWall: { icon: '🧱', title: 'Great Wall marker' },
  greatBridge: { icon: '🌉', title: 'Great Bridge marker' },
  lighthouse: { icon: '🗼', title: 'Lighthouse marker' },
};

function WonderSites({ game }: Props) {
  if (!game.wonderSites) return null;
  const sites = new Set<VertexId>();
  const items: Array<{ v: VertexId; kind: string }> = [];
  for (const [kind, vertices] of Object.entries(game.wonderSites)) {
    for (const v of vertices ?? []) {
      sites.add(v);
      items.push({ v, kind });
    }
  }
  const xMarkers = (game.setupBlockedVertices ?? []).filter((v) => !sites.has(v));
  return (
    <g className="wonder-sites">
      {items.map(({ v, kind }) => {
        const { x, y } = vertexPos(game, v);
        const s = SITE_ICON[kind]!;
        return (
          <g key={`${kind}-${v}`} transform={`translate(${x}, ${y})`}>
            <title>{s.title}</title>
            <circle r={7.5} fill="#fdf6e3" stroke="#5b4636" strokeWidth={1} opacity={0.92} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={8.5}>
              {s.icon}
            </text>
          </g>
        );
      })}
      {xMarkers.map((v) => {
        const { x, y } = vertexPos(game, v);
        return (
          <g key={`x-${v}`} transform={`translate(${x}, ${y})`}>
            <title>No starting settlement here</title>
            <circle r={5.5} fill="#9b1c1c" stroke="#fff" strokeWidth={1} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={7} fontWeight={700} fill="#fff">
              ×
            </text>
          </g>
        );
      })}
    </g>
  );
}

// Pirate Islands: the fleet's loop as chevrons between consecutive path
// hexes, plus the 5-6p "!" hex where it doesn't attack.
function PirateLoop({ game }: Props) {
  const pi = game.pirateIslands;
  if (!pi || pi.fleetIndex < 0) return null;
  const centers = pi.path.map((h) => game.board.hexes[h]!.center);
  return (
    <g className="pirate-loop">
      {centers.map((a, i) => {
        const b = centers[(i + 1) % centers.length]!;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        return (
          <path
            key={i}
            d="M-5,-4 L1,0 L-5,4"
            transform={`translate(${mx}, ${my}) rotate(${angle})`}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
      {pi.noAttackHex && (
        <g transform={`translate(${game.board.hexes[pi.noAttackHex]!.center.x}, ${game.board.hexes[pi.noAttackHex]!.center.y + 18})`}>
          <title>The pirate fleet doesn't attack from this hex</title>
          <text textAnchor="middle" dominantBaseline="central" fontSize={16} fontWeight={800} fill="#fff">
            !
          </text>
        </g>
      )}
    </g>
  );
}

function Fortresses({ game }: Props) {
  const pi = game.pirateIslands;
  if (!pi) return null;
  return (
    <g className="pirate-fortresses">
      {pi.fortresses.map((f) => {
        const c = colorOf(game, f.playerId);
        const hex = c ? PLAYER_COLOR_HEX[c] : '#888';
        const name = game.players.find((p) => p.id === f.playerId)?.name ?? f.playerId;
        const b = vertexPos(game, f.beachhead);
        const fp = vertexPos(game, f.vertex);
        return (
          <g key={f.playerId}>
            <g transform={`translate(${b.x}, ${b.y})`}>
              <title>{`${name}'s beachhead`}</title>
              <circle r={8} fill="none" stroke={hex} strokeWidth={3} />
              <circle r={8} fill="none" stroke="#1a1a1a" strokeWidth={0.8} />
            </g>
            {f.lairs > 0 && (
              <g transform={`translate(${fp.x}, ${fp.y})`}>
                <title>{`${name}'s pirate fortress — ${f.lairs} lair token${f.lairs === 1 ? '' : 's'} left`}</title>
                <path
                  d="M-8,6 L-8,-3 L-5,-3 L-5,-6 L-2,-6 L-2,-3 L2,-3 L2,-6 L5,-6 L5,-3 L8,-3 L8,6 Z"
                  fill={hex}
                  stroke="#1a1a1a"
                  strokeWidth={1.2}
                  strokeLinejoin="round"
                />
                <circle cx={9} cy={-9} r={5.5} fill="#1a1a1a" stroke="#fff" strokeWidth={0.8} />
                <text x={9} y={-9} textAnchor="middle" dominantBaseline="central" fontSize={7} fontWeight={700} fill="#fff">
                  {f.lairs}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
