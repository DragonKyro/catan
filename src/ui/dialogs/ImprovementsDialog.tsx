import type { ImprovementTrack } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { TRACK_COMMODITY } from '@/game/types';
import {
  TRACK_EMOJI,
  TRACK_LABEL,
  MAX_IMPROVEMENT_LEVEL,
  LEVEL3_ABILITY_THRESHOLD,
} from '@/game/modules/citiesAndKnights/constants';
import { COMMODITY_EMOJI } from '@/ui/shared/CommodityChip';
import { improvementCost } from '@/game/modules/citiesAndKnights/improvements/state';

const TRACKS: ImprovementTrack[] = ['science', 'trade', 'politics'];

const LEVEL3_ABILITY: Record<ImprovementTrack, string> = {
  science: 'Aqueduct — when production gives you nothing, take 1 resource.',
  trade: 'Merchant Guild — trade commodities 2:1 with the bank.',
  politics: 'Fortress — promote knights to mighty (level 3).',
};

export function ImprovementsDialog() {
  const { game, dialog, dispatch, closeDialog } = useGameStore();
  if (!game || dialog !== 'cityImprovements') return null;
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting);
  if (!player) return null;
  const crane = !!game.craneActive;

  return (
    <DialogShell title="City Improvements" variant="docked" onClose={closeDialog}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {TRACKS.map((track) => {
          const level = player.improvements?.[track] ?? 0;
          const isMax = level >= MAX_IMPROVEMENT_LEVEL;
          const next = level + 1;
          const cost = improvementCost(track, next, crane);
          const owned = player.commodities?.[cost.commodity] ?? 0;
          const cant =
            isMax ||
            player.cities.length === 0 ||
            owned < cost.amount;
          const metro = game.metropolises?.[track];
          return (
            <div
              key={track}
              style={{
                padding: 8,
                border: '1px solid var(--panel-border)',
                borderRadius: 6,
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {TRACK_EMOJI[track]} {TRACK_LABEL[track]}
              </div>
              <div style={{ fontSize: '0.85em', color: 'var(--text-soft)' }}>
                Level {level} / {MAX_IMPROVEMENT_LEVEL}
              </div>
              {/* 5-pip bar */}
              <div style={{ display: 'flex', gap: 3, margin: '6px 0' }}>
                {Array.from({ length: MAX_IMPROVEMENT_LEVEL }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 12,
                      height: 8,
                      borderRadius: 2,
                      background:
                        i < level
                          ? i + 1 >= LEVEL3_ABILITY_THRESHOLD
                            ? 'var(--accent)'
                            : 'var(--accent)'
                          : 'rgba(255,255,255,0.1)',
                      border: '1px solid var(--panel-border)',
                    }}
                  />
                ))}
              </div>
              {!isMax && (
                <div style={{ fontSize: '0.85em', marginBottom: 6 }}>
                  Next ({next}): {cost.amount}
                  {COMMODITY_EMOJI[TRACK_COMMODITY[track]]}
                </div>
              )}
              <Button
                disabled={cant}
                onClick={() => {
                  dispatch({
                    type: 'buildCityImprovement',
                    playerId: acting,
                    track,
                  });
                  closeDialog();
                }}
                size="sm"
                fullWidth
              >
                {isMax ? 'Maxed' : `Buy →L${next}`}
              </Button>
              {level >= LEVEL3_ABILITY_THRESHOLD && (
                <div
                  style={{
                    fontSize: '0.75em',
                    color: 'var(--text-soft)',
                    marginTop: 6,
                    fontStyle: 'italic',
                  }}
                >
                  {LEVEL3_ABILITY[track]}
                </div>
              )}
              {metro && (
                <div style={{ fontSize: '0.8em', marginTop: 4 }}>
                  🏛 Metropolis: {game.players.find((p) => p.id === metro.playerId)?.name}
                  {metro.permanent ? ' ★ permanent' : ' (temp)'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DialogShell>
  );
}
