import { useGameStore } from '@/store/gameStore';
import { COMMODITIES } from '@/game/types';
import { BARBARIAN_TRACK_LENGTH } from '@/game/modules/citiesAndKnights/constants';
import { CommodityChip } from '@/ui/shared/CommodityChip';
import { playerColorVar } from '@/ui/shared/playerColors';
import './BarbariansPanel.css';

// Side-panel tab content for the Cities & Knights tracker. Phase 1 surfaces
// the barbarian ship's position, the strength tally (cities vs. knights —
// knights placeholder for Phase 8e), attacks resolved, and per-player wall
// counts so players can read the table at a glance.
export function BarbariansPanel() {
  const game = useGameStore((s) => s.game);
  if (!game || !game.barbarian) return null;
  const { barbarian } = game;
  const barbarianStrength = game.players.reduce(
    (acc, p) => acc + p.cities.length,
    0,
  );
  // Defender strength = 0 until knights ship (Phase 8e). Show "—" so it's
  // clear the system isn't yet computing anything.
  const defenderStrength: number | '—' = '—';

  return (
    <div className="barbarians-panel">
      <header className="bp-header">
        <span className="bp-title">Barbarian Track</span>
        <span className="bp-attacks" title="Attacks resolved so far">
          ⚔️ {barbarian.attacksResolved}
        </span>
      </header>

      <div
        className="bp-track"
        title={`Ship at ${barbarian.position} of ${BARBARIAN_TRACK_LENGTH}`}
      >
        {Array.from({ length: BARBARIAN_TRACK_LENGTH + 1 }, (_, i) => {
          const here = barbarian.position === i;
          const isEnd = i === BARBARIAN_TRACK_LENGTH;
          return (
            <span
              key={i}
              className={`bp-cell ${here ? 'is-here' : ''} ${isEnd ? 'is-end' : ''}`}
              aria-hidden
            >
              {here ? '🚢' : isEnd ? '🏝' : '·'}
            </span>
          );
        })}
      </div>

      <div className="bp-strengths">
        <div className="bp-row">
          <span className="bp-label">Barbarian strength</span>
          <span className="bp-val bp-bad">{barbarianStrength}</span>
        </div>
        <div className="bp-row">
          <span className="bp-label">Defender strength</span>
          <span className="bp-val bp-good">{defenderStrength}</span>
        </div>
        <div className="bp-hint">
          (Knights, city improvements and progress cards land in upcoming phases.
          For now every attack pillages a city per player.)
        </div>
      </div>

      <header className="bp-subheader">Walls &amp; commodities</header>
      <table className="bp-table">
        <thead>
          <tr>
            <th>Player</th>
            <th title="City walls">🧱</th>
            {COMMODITIES.map((c) => (
              <th key={c}>{c === 'paper' ? '📜' : c === 'cloth' ? '🧵' : '🪙'}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {game.playerOrder.map((id) => {
            const p = game.players.find((x) => x.id === id);
            if (!p) return null;
            return (
              <tr key={id}>
                <td>
                  <span
                    className="bp-swatch"
                    style={{ background: playerColorVar(p.color) }}
                  />
                  {p.name}
                </td>
                <td>{p.cityWalls ?? 0}</td>
                {COMMODITIES.map((c) => (
                  <td key={c}>
                    <CommodityChip
                      commodity={c}
                      count={p.commodities?.[c] ?? 0}
                      size="sm"
                      dimmed={(p.commodities?.[c] ?? 0) === 0}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import type { GameState } from '@/game/types';

export function hasBarbariansTracker(game: GameState | null | undefined): boolean {
  if (!game) return false;
  return game.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID);
}
