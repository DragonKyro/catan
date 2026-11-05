import { useState } from 'react';
import type { GameState, PlayerId, Resource, SpendFishAction } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import { useCanAct } from '@/ui/shared/useCanAct';
import { playerColorVar } from '@/ui/shared/playerColors';
import { canConnectRoad } from '@/game/placement';
import { totalResources } from '@/game/resources';
import { fishCost, fishTotal, pickFishTokens } from '@/game/modules/traders/actions/spendFish';
import { FishTokenIcon, fishValue } from '@/ui/game/traders/TradersIcons';

type Effect = SpendFishAction['effect']['kind'];

const EFFECTS: Array<{ kind: Effect; label: string; icon: string }> = [
  { kind: 'removeRobber', label: 'Remove the robber', icon: '🥾' },
  { kind: 'steal', label: 'Steal a random card', icon: '🫳' },
  { kind: 'takeFromBank', label: 'Take a card of your choice', icon: '🎁' },
  { kind: 'buildRoad', label: 'Build a road for free', icon: '🛣' },
  { kind: 'buyDevCard', label: 'Take a development card', icon: '🃏' },
];

// Fishing on Catan (rulebook p. 10): spend fish tokens on your turn. Each
// action is paid on its own; the dialog picks the tokens that waste the
// fewest fish (the excess on spent tokens is lost).
export function SpendFishDialog() {
  const { game, dispatch, closeDialog, setMode } = useGameStore();
  const [effect, setEffect] = useState<Effect | null>(null);
  const [resource, setResource] = useState<Resource | null>(null);
  const [victim, setVictim] = useState<PlayerId | null>(null);
  const acting = game ? getActingPlayerId(game) : null;
  const canAct = useCanAct(game, acting);
  if (!game || !acting || game.phase !== 'main' || !canAct) return null;
  const player = game.players.find((p) => p.id === acting);
  if (!player) return null;
  const hand = player.fishTokens ?? [];
  const total = fishTotal(hand);

  const blocked = (kind: Effect): string | null => {
    if (total < fishCost(kind)) return `Needs ${fishCost(kind)} fish (you have ${total})`;
    return blockedReason(game, acting, kind);
  };
  const chosen = effect && !blocked(effect) ? effect : null;
  const tokens = chosen ? pickFishTokens(hand, fishCost(chosen)) : null;
  const victims = game.players.filter((p) => p.id !== acting && totalResources(p.resources) > 0);
  const ready =
    !!tokens &&
    (chosen !== 'takeFromBank' || (resource !== null && game.bank[resource] > 0)) &&
    (chosen !== 'steal' || victims.some((p) => p.id === victim));

  const submit = () => {
    if (!tokens || !chosen) return;
    if (chosen === 'buildRoad') {
      // Pick the edge on the board; PlacementOverlay dispatches the spend.
      setMode({ kind: 'fishRoad', tokens });
      closeDialog();
      return;
    }
    const fx: SpendFishAction['effect'] =
      chosen === 'takeFromBank'
        ? { kind: 'takeFromBank', resource: resource! }
        : chosen === 'steal'
          ? { kind: 'steal', target: victim! }
          : chosen === 'removeRobber'
            ? { kind: 'removeRobber' }
            : { kind: 'buyDevCard' };
    dispatch({ type: 'spendFish', playerId: acting, tokens, effect: fx });
  };

  return (
    <DialogShell
      title="Spend fish"
      onClose={closeDialog}
      footer={
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="primary" disabled={!ready} onClick={submit}>
            {chosen === 'buildRoad' ? 'Choose where ▸' : 'Spend'}
          </Button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--text-soft)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {hand.map((t, i) => (
          <FishTokenIcon key={i} size={20} fish={fishValue(t)} />
        ))}
        <span style={{ marginLeft: 4 }}>
          <strong style={{ color: 'var(--text)' }}>{total} fish</strong>. Pay each action
          separately; extra fish on the tokens you spend are lost.
        </span>
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
        {EFFECTS.map((e) => {
          const why = blocked(e.kind);
          return (
            <Button
              key={e.kind}
              size="sm"
              variant={effect === e.kind ? 'primary' : 'secondary'}
              disabled={why !== null}
              title={why ?? e.label}
              onClick={() => setEffect(e.kind)}
            >
              <span style={{ display: 'inline-block', minWidth: 22, fontWeight: 700 }}>{fishCost(e.kind)}</span>
              {e.icon} {e.label}
            </Button>
          );
        })}
      </div>
      {chosen === 'takeFromBank' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {RESOURCES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={resource === r ? 'primary' : 'secondary'}
              disabled={game.bank[r] === 0}
              onClick={() => setResource(r)}
            >
              <ResourceChip resource={r} count={game.bank[r]} size="sm" dimmed={game.bank[r] === 0} />
            </Button>
          ))}
        </div>
      )}
      {chosen === 'steal' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {victims.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={victim === p.id ? 'primary' : 'secondary'}
              onClick={() => setVictim(p.id)}
              title={`${p.name} holds ${totalResources(p.resources)} cards`}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: playerColorVar(p.color),
                  marginRight: 6,
                }}
              />
              {p.name} ({totalResources(p.resources)})
            </Button>
          ))}
        </div>
      )}
      {tokens && (
        <div style={{ fontSize: '0.85em', color: 'var(--text-soft)', display: 'flex', alignItems: 'center', gap: 4 }}>
          Pays with
          {tokens.map((t, i) => (
            <FishTokenIcon key={i} size={18} fish={fishValue(t)} />
          ))}
          {fishTotal(tokens) > fishCost(chosen!) && ` (${fishTotal(tokens) - fishCost(chosen!)} fish lost)`}
        </div>
      )}
    </DialogShell>
  );
}

// Why an effect can't be used right now (besides the fish), or null.
function blockedReason(game: GameState, playerId: PlayerId, kind: Effect): string | null {
  const player = game.players.find((p) => p.id === playerId)!;
  switch (kind) {
    case 'removeRobber':
      return game.robberActive === false ? 'The robber is already off the board' : null;
    case 'steal':
      return game.players.some((p) => p.id !== playerId && totalResources(p.resources) > 0)
        ? null
        : 'Nobody has a card to steal';
    case 'takeFromBank':
      return RESOURCES.some((r) => game.bank[r] > 0) ? null : 'The supply is empty';
    case 'buildRoad':
      if (player.roads.length >= 15) return 'No roads left';
      return game.board.edgeIds.some((e) => canConnectRoad(game, playerId, e))
        ? null
        : 'No legal place for a road';
    case 'buyDevCard':
      return game.devCardDeck.length > 0 ? null : 'The development deck is empty';
  }
}
