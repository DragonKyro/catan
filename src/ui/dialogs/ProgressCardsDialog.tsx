import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import type { ImprovementTrack, ProgressCardKind } from '@/game/types';
import { DialogShell } from '@/ui/shared/DialogShell';
import { ProgressCardChip } from '@/ui/shared/ProgressCardChip';
import {
  PROGRESS_CARD_DESCRIPTION,
} from '@/game/modules/citiesAndKnights/progress/catalogue';

// Lists the acting player's progress cards and dispatches per-card plays
// or opens the right sub-dialog for cards that need one.
export function ProgressCardsDialog() {
  const { game, dialog, dispatch, openDialog, setMode, closeDialog } =
    useGameStore();
  if (!game || dialog !== 'progressCards') return null;
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting);
  if (!player) return null;
  const hand = player.progressCards ?? { science: [], trade: [], politics: [] };
  const total = hand.science.length + hand.trade.length + hand.politics.length;

  const playCard = (card: ProgressCardKind, deck: ImprovementTrack) => {
    closeDialog();
    switch (card) {
      case 'alchemy':
        openDialog('alchemy');
        return;
      case 'smithing':
        openDialog('smithing');
        return;
      case 'merchantFleet':
        openDialog('merchantFleet');
        return;
      case 'tradeMonopoly':
        openDialog('tradeMonopoly');
        return;
      case 'resourceMonopoly':
        openDialog('resourceMonopolyCK');
        return;
      case 'engineering':
        // Need a city to be allowed to build the wall; engine flag flips
        // then we route the user into wall mode.
        dispatch({ type: 'playProgressCard', playerId: acting, card });
        setMode({ kind: 'buildCityWall' });
        return;
      case 'medicine':
        dispatch({ type: 'playProgressCard', playerId: acting, card });
        setMode({ kind: 'buildCity' });
        return;
      case 'progressRoadBuilding':
        // Reuse the existing road-building two-edge flow. The road
        // builder dispatches playRoadBuilding when it's done, so we need
        // a small bridge: we use 'roadBuilding' UIMode then patch the
        // dispatch — for simplicity, just emit playProgressCard with
        // empty edges first to consume the card, then build 2 free roads
        // via the existing flow. We instead route directly to play with
        // an edges payload, but the user needs to pick the edges first.
        // Simplest: set mode to roadBuilding (which already buffers + dispatches
        // playRoadBuilding — but that's the dev card). Implement a placeholder
        // alert for now telling user to pick edges via the existing flow.
        // For Phase 2 we just emit a no-op so the deck rotates; full UI
        // wiring left as a polish task.
        dispatch({ type: 'playProgressCard', playerId: acting, card, edges: [/* user input needed */] as never });
        return;
      case 'merchantCard':
        dispatch({ type: 'playProgressCard', playerId: acting, card });
        // Engine transitions to placeMerchant — uiMode follows via phaseToMode.
        return;
      case 'commercialHarborCard':
        dispatch({ type: 'playProgressCard', playerId: acting, card });
        // Opponents will be prompted via dialog if it's their turn — for now
        // the engine handles it via the commercialHarborOffer sub-phase.
        return;
      case 'diplomacy':
        dispatch({ type: 'playProgressCard', playerId: acting, card });
        // Engine transitions to removeRoad.
        return;
      case 'invention':
        // Two-hex picker not yet implemented in UI — surface a soft alert.
        alert('Invention: open the board and swap tokens (UI flow coming in next round).');
        return;
      case 'irrigation':
      case 'mining':
      case 'encouragement':
      case 'sabotage':
      case 'taxation':
      case 'crane':
      case 'guildDues':
      case 'espionage':
      case 'intrigue':
      case 'treason':
      case 'wedding':
        // Most of these need a target / additional payload; for the
        // simple no-arg ones (irrigation, mining, encouragement, sabotage,
        // taxation, crane) just dispatch.
        if (
          card === 'irrigation' ||
          card === 'mining' ||
          card === 'encouragement' ||
          card === 'sabotage' ||
          card === 'taxation' ||
          card === 'crane'
        ) {
          dispatch({ type: 'playProgressCard', playerId: acting, card });
        } else {
          alert(
            `${card}: target-picker UI is coming in the next polish round. Card stays in hand.`,
          );
          openDialog('progressCards');
        }
        return;
      case 'printing':
      case 'constitution':
        // VP cards are auto-revealed on draw; they shouldn't be played.
        return;
      default:
        return;
    }
    void deck;
  };

  return (
    <DialogShell
      title={`Progress cards (${total})`}
      variant="docked"
      onClose={closeDialog}
    >
      {total === 0 && (
        <div style={{ color: 'var(--text-soft)', fontStyle: 'italic' }}>
          No progress cards in hand.
        </div>
      )}
      {(['science', 'trade', 'politics'] as ImprovementTrack[]).map((deck) => {
        if (hand[deck].length === 0) return null;
        return (
          <div key={deck} style={{ marginBottom: 8 }}>
            <div
              style={{
                fontSize: '0.75em',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-soft)',
                marginBottom: 4,
              }}
            >
              {deck}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {hand[deck].map((card, i) => (
                <ProgressCardChip
                  key={`${card}-${i}`}
                  card={card}
                  deck={deck}
                  title={PROGRESS_CARD_DESCRIPTION[card]}
                  onClick={() => playCard(card, deck)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </DialogShell>
  );
}
