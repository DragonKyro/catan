import type { GameState } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';
import { playerKnightEdges } from '@/game/modules/traders/barbarianAttack/knights';
import {
  conqueredBuildingVertices,
  conqueredHexes,
  prisonersOf,
} from '@/game/modules/traders/barbarianAttack/state';
import {
  BARBARIAN_KNIGHTS_PER_PLAYER,
  BARBARIAN_PRISONERS_PER_VP,
} from '@/game/modules/traders/constants';
import { describeHex, expelLine } from '@/store/barbarianAttackLog';

// Barbarian Attack block of the Scenario tab: each player's prisoners,
// knights, gold and conquered buildings; the coast (barbarians per hex,
// conquered hexes); the supply and the deck; and the last expel.
export function BarbarianAttackPanel({ game }: { game: GameState }) {
  const ba = game.barbarianAttack;
  if (!ba) return null;
  const conquered = conqueredHexes(game);
  const lostBuildings = conqueredBuildingVertices(game);
  const coast = ba.coastalHexes.filter((h) => (ba.barbarians[h] ?? 0) > 0);
  const lastExpel = ba.lastEvents?.events.find((e) => e.kind === 'expel');
  return (
    <div className="scenario-panel-block">
      <div className="scenario-panel-block-head">
        <span>Barbarian Attack · {game.settings.victoryPointsToWin} VP wins</span>
        <span className="scenario-panel-block-sum" title="Barbarians next to the board">
          {ba.supply} barbarians left
        </span>
      </div>
      <ul className="scenario-panel-chips">
        {game.players.map((p) => {
          const knights = playerKnightEdges(game, p.id).length;
          const prisoners = prisonersOf(game, p.id);
          const lost = [...p.settlements, ...p.cities].filter((v) => lostBuildings.has(v)).length;
          return (
            <li key={p.id} className="scenario-panel-chip is-claimed">
              <span
                className="scenario-panel-chip-vp"
                title={`${prisoners} prisoners = ${Math.floor(prisoners / BARBARIAN_PRISONERS_PER_VP)} VP`}
              >
                ⛓ {prisoners}
              </span>
              <span
                className="scenario-panel-chip-swatch"
                style={{ background: playerColorVar(p.color) }}
                aria-hidden
              />
              <span className="scenario-panel-chip-name">{p.name}</span>
              <span className="scenario-panel-chip-type" title="Knights on the board">
                ⚔ {knights}/{BARBARIAN_KNIGHTS_PER_PLAYER}
              </span>
              <span className="scenario-panel-chip-type" title="Gold">
                🪙 {p.gold ?? 0}
              </span>
              {lost > 0 && (
                <span className="scenario-panel-chip-type" title="Conquered buildings: no VP, no port">
                  🏚 {lost}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="scenario-panel-note" style={{ fontStyle: 'normal' }}>
        <strong>Coast:</strong>{' '}
        {coast.length === 0
          ? 'no barbarians'
          : coast.map((h) => `${describeHex(game, h)} ×${ba.barbarians[h] ?? 0}`).join(' · ')}
        {conquered.length > 0 && (
          <>
            {' — '}
            <strong>conquered:</strong> {conquered.map((h) => describeHex(game, h)).join(', ')}
          </>
        )}
      </div>
      <div className="scenario-panel-note">
        Deck: {ba.deck.length} cards ({ba.discard.length} played). Each building lands 3 barbarians;
        3 on a hex conquer it. End of turn: move your knights, then every coastal hex where knights
        outnumber its barbarians is freed — 2 prisoners = 1 VP.
      </div>
      {lastExpel && lastExpel.kind === 'expel' && (
        <div className="scenario-panel-note" style={{ fontStyle: 'normal' }}>
          <strong>Last expel:</strong> {lastExpel.results.map((r) => expelLine(game, r)).join(' · ')}
        </div>
      )}
    </div>
  );
}
