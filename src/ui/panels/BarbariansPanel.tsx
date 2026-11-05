import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/game/types';
import { IMPROVEMENT_TRACKS } from '@/game/types';
import {
  BARBARIAN_TRACK_LENGTH,
  CITIES_AND_KNIGHTS_EXPANSION_ID,
} from '@/game/modules/citiesAndKnights/constants';
import {
  barbarianStrength,
  defenderStrengthByPlayer,
} from '@/game/modules/citiesAndKnights/barbarian';
import { handLimitOnSeven } from '@/game/modules/citiesAndKnights/production';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { ProgressCardBack } from '@/ui/shared/ProgressCardFace';
import { playerColorVar } from '@/ui/shared/playerColors';
import './BarbariansPanel.css';

// Side-panel tab for Cities & Knights: the barbarian track drawn like the
// sea frame piece (ship, wave spaces, the attack space with the robber
// waiting beside it until the first attack), barbarian strength against the
// active knights, the last attack, the progress decks, and each player's
// defense numbers.
export function BarbariansPanel() {
  const game = useGameStore((s) => s.game);
  if (!game || !game.barbarian) return null;
  const { barbarian } = game;
  const barbStr = barbarianStrength(game);
  const byPlayer = defenderStrengthByPlayer(game);
  const defense = Object.values(byPlayer).reduce((a, b) => a + b, 0);
  const toGo = BARBARIAN_TRACK_LENGTH - barbarian.position;
  const last = game.lastBarbarianAttack;
  const name = (pid: string) => game.players.find((p) => p.id === pid)?.name ?? pid;

  return (
    <div className="barbarians-panel">
      <header className="bp-header">
        <span className="bp-title">Barbarians</span>
        <span className="bp-attacks" title="Attacks so far">
          ⚔ {barbarian.attacksResolved} attack{barbarian.attacksResolved === 1 ? '' : 's'}
        </span>
      </header>

      <BarbarianTrack game={game} />
      <div className="bp-hint">
        {toGo === 1
          ? 'The next ship on the event die attacks!'
          : `${toGo} more ship${toGo === 1 ? '' : 's'} on the event die until the attack.`}
        {!game.robberActive && ' The robber waits by the track until the first attack.'}
      </div>

      <div className="bp-strengths">
        <StrengthBar barbarians={barbStr} defense={defense} />
        <div className="bp-hint">
          Barbarians = cities on the board ({barbStr}); defense = active knights ({defense}).
          {defense >= barbStr
            ? ' Catan holds: the top defender gets 1 VP (ties draw a progress card).'
            : ' Catan falls: the weakest defenders each lose a city (not a metropolis).'}
        </div>
      </div>

      {last && (
        <div className="bp-last">
          <strong>Last attack:</strong> {last.barbarianStrength} vs {last.defenderStrength} —{' '}
          {last.outcome === 'defended'
            ? last.defender
              ? `defended; ${name(last.defender)} took a VP token.`
              : last.tied?.length
                ? `defended; ${last.tied.map(name).join(' & ')} tied and drew progress cards.`
                : 'defended.'
            : `pillaged: ${last.losers?.length ? last.losers.map(name).join(', ') : 'nobody could be'} lost a city.`}
        </div>
      )}

      <header className="bp-subheader">Progress decks</header>
      <div className="bp-decks">
        {IMPROVEMENT_TRACKS.map((t) => (
          <ProgressCardBack key={t} deck={t} count={game.progressDecks?.[t].length ?? 0} />
        ))}
      </div>

      <header className="bp-subheader">Defenders</header>
      <table className="bp-table">
        <thead>
          <tr>
            <th>Player</th>
            <th title="Cities (barbarian strength they add)">🏛</th>
            <th title="Active knight strength">⚔</th>
            <th title="City walls / cards held safely on a 7">🧱</th>
            <th title="Defender of Catan VP tokens">🛡</th>
            <th title="Victory points">VP</th>
          </tr>
        </thead>
        <tbody>
          {game.playerOrder.map((id) => {
            const p = game.players.find((x) => x.id === id);
            if (!p) return null;
            return (
              <tr key={id}>
                <td>
                  <span className="bp-swatch" style={{ background: playerColorVar(p.color) }} />
                  {p.name}
                </td>
                <td>{p.cities.length}</td>
                <td>{byPlayer[p.id] ?? 0}</td>
                <td>
                  {p.cityWalls ?? 0} / {handLimitOnSeven(game, p.id)}
                </td>
                <td>{p.defenderTokens ?? 0}</td>
                <td>{calculateVictoryPoints(game, p.id, false)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// The sea-frame track: a start space with the ship, wave-crest spaces, and
// the attack space by the coast. The ship sits on its current space.
function BarbarianTrack({ game }: { game: GameState }) {
  const pos = game.barbarian!.position;
  const n = BARBARIAN_TRACK_LENGTH; // spaces 0..n
  const w = 260;
  const h = 70;
  const xs = (i: number) => 18 + (i * (w - 52)) / n;
  const ys = (i: number) => 46 - Math.sin((i / n) * Math.PI) * 14;
  return (
    <svg
      className="bp-track-svg"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`Barbarian ship on space ${pos} of ${n}`}
    >
      <rect x={0} y={0} width={w} height={h} rx={8} fill="#2f6fa3" />
      <path d={`M0,${h - 10} Q${w / 4},${h - 18} ${w / 2},${h - 10} T${w},${h - 10} L${w},${h} L0,${h} Z`} fill="#28618f" />
      {/* Coast + attack space */}
      <path d={`M${w - 30},0 Q${w - 18},${h / 2} ${w - 30},${h} L${w},${h} L${w},0 Z`} fill="#d9c38c" />
      {Array.from({ length: n + 1 }, (_, i) => {
        const x = xs(i);
        const y = ys(i);
        const isEnd = i === n;
        return (
          <g key={i} transform={`translate(${x}, ${y})`}>
            {isEnd ? (
              <circle r={9} fill="#c0392b" stroke="#fff" strokeWidth={1.5}>
                <title>Attack</title>
              </circle>
            ) : (
              <path d="M-8,3 Q-4,-6 0,-1 Q4,-6 8,3" fill="none" stroke="#e8f3fb" strokeWidth={2} strokeLinecap="round" />
            )}
            {isEnd && <text y={3.5} textAnchor="middle" fontSize={10} fill="#fff" fontWeight={800}>⚔</text>}
          </g>
        );
      })}
      {/* Robber waiting beside the attack space until the first attack. */}
      {!game.robberActive && (
        <g transform={`translate(${w - 14}, ${h / 2 + 4})`}>
          <title>The robber waits here until the first barbarian attack</title>
          <ellipse cx={0} cy={9} rx={6} ry={2} fill="#00000055" />
          <path d="M0,-9 C4,-9 6,-6 6,-2 L6,6 L-6,6 L-6,-2 C-6,-6 -4,-9 0,-9 Z" fill="#1a1a1a" stroke="#fefefe" strokeWidth={0.8} />
          <circle cx={0} cy={-3} r={1.6} fill="#fefefe" />
        </g>
      )}
      {/* Barbarian ship */}
      <g transform={`translate(${xs(pos)}, ${ys(pos) - 6})`}>
        <BarbarianShip />
      </g>
    </svg>
  );
}

// The grey barbarian ship (p.3): a curved hull with a tall sail.
export function BarbarianShip() {
  return (
    <g>
      <path d="M-11,2 L11,2 Q8,9 0,9 Q-8,9 -11,2 Z" fill="#7b7f86" stroke="#1d1d1d" strokeWidth={1} />
      <path d="M-1,1 L-1,-15 Q9,-9 7,0 Z" fill="#c9ccd1" stroke="#1d1d1d" strokeWidth={1} />
      <path d="M-1,-15 L-1,2" stroke="#1d1d1d" strokeWidth={1.2} />
      <path d="M-11,2 Q-14,-2 -12,-5" fill="none" stroke="#1d1d1d" strokeWidth={1.2} />
    </g>
  );
}

function StrengthBar({ barbarians, defense }: { barbarians: number; defense: number }) {
  const max = Math.max(1, barbarians, defense);
  const holds = defense >= barbarians;
  return (
    <div className="bp-bars">
      <div className="bp-bar-row">
        <span className="bp-label">Barbarians</span>
        <span className="bp-bar">
          <span className="bp-bar-fill bp-bar-barb" style={{ width: `${(barbarians / max) * 100}%` }} />
        </span>
        <span className="bp-val bp-bad">{barbarians}</span>
      </div>
      <div className="bp-bar-row">
        <span className="bp-label">Knights</span>
        <span className="bp-bar">
          <span className={`bp-bar-fill ${holds ? 'bp-bar-good' : 'bp-bar-weak'}`} style={{ width: `${(defense / max) * 100}%` }} />
        </span>
        <span className={`bp-val ${holds ? 'bp-good' : 'bp-bad'}`}>{defense}</span>
      </div>
    </div>
  );
}

export function hasBarbariansTracker(game: GameState | null | undefined): boolean {
  if (!game) return false;
  return game.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID);
}
