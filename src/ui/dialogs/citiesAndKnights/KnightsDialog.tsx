import type { GameState, KnightStrength, PlayerId } from '@/game/types';
import { COSTS } from '@/game/types';
import { useGameStore } from '@/store/gameStore';
import type { UIMode } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { canAfford } from '@/game/resources';
import {
  canChaseRobberFrom,
  canPromoteKnightAt,
  knightCanAct,
  legalDisplaceTargets,
  legalKnightMoves,
  recruitSpots,
} from '@/game/modules/citiesAndKnights/knights/legal';
import { supplyAvailable } from '@/game/modules/citiesAndKnights/knights/state';
import { KNIGHT_LABEL } from '@/game/modules/citiesAndKnights/constants';
import { KnightGlyph } from '@/ui/game/citiesAndKnights/KnightPiece';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Option {
  label: string;
  cost: string;
  mode: UIMode;
  blocker: string | null;
}

// Everything a player can do with knights this turn (p.9-10), each with its
// cost and, when unavailable, why. Picking one switches the board to that
// click mode.
export function knightOptions(game: GameState, pid: PlayerId): Option[] {
  const me = game.players.find((p) => p.id === pid)!;
  const mine = Object.entries(game.knights ?? {}).filter(([, k]) => k.playerId === pid);
  const acting = mine.filter(([v]) => knightCanAct(game, v));
  const canMove = acting.some(([v]) => legalKnightMoves(game, v).length > 0);
  const canDisplace = acting.some(([v]) => legalDisplaceTargets(game, v).length > 0);
  const canChase = acting.some(([v]) => canChaseRobberFrom(game, v));
  const promotable = mine.some(([v]) => canPromoteKnightAt(game, pid, v));
  return [
    {
      label: 'Recruit a knight',
      cost: '1 🐑 + 1 🪨',
      mode: { kind: 'recruitKnight' },
      blocker:
        supplyAvailable(game, pid, 1) <= 0
          ? 'No basic knight left — promote one first'
          : !canAfford(me.resources, COSTS.knight)
            ? 'Needs 1 wool + 1 ore'
            : recruitSpots(game, pid).length === 0
              ? 'No empty intersection on your roads'
              : null,
    },
    {
      label: 'Activate a knight',
      cost: '1 🌾',
      mode: { kind: 'activateKnight' },
      blocker: !mine.some(([, k]) => !k.active)
        ? 'No inactive knight'
        : !canAfford(me.resources, COSTS.activateKnight)
          ? 'Needs 1 wheat'
          : null,
    },
    {
      label: 'Promote a knight',
      cost: '1 🐑 + 1 🪨',
      mode: { kind: 'promoteKnight' },
      blocker: !promotable
        ? (me.improvements?.politics ?? 0) < 3 && mine.every(([, k]) => k.strength >= 2)
          ? 'Strong → mighty needs politics level 3 (Fortress)'
          : 'No knight can be promoted (once per knight per turn, stronger piece in supply)'
        : !canAfford(me.resources, COSTS.promoteKnight)
          ? 'Needs 1 wool + 1 ore'
          : null,
    },
    {
      label: 'Move a knight',
      cost: 'free · lays it down',
      mode: { kind: 'moveKnight' },
      blocker: acting.length === 0 ? actingReason(mine.length) : canMove || canChase || canDisplace ? null : 'No empty intersection along your roads',
    },
    {
      label: 'Displace a knight',
      cost: 'free · lays it down',
      mode: { kind: 'displaceKnight' },
      blocker: acting.length === 0 ? actingReason(mine.length) : canDisplace ? null : 'No weaker opposing knight on your roads',
    },
    {
      label: 'Chase away the robber',
      cost: 'free · lays it down',
      mode: { kind: 'chaseRobber' },
      blocker: !game.robberActive
        ? 'The robber arrives with the first barbarian attack'
        : acting.length === 0
          ? actingReason(mine.length)
          : canChase
            ? null
            : 'No acting knight next to the robber',
    },
  ];
}

function actingReason(owned: number): string {
  return owned === 0
    ? 'You have no knights'
    : 'Only knights that were active at the start of your turn may act';
}

export function KnightsDialog({ game, pid, onClose }: { game: GameState; pid: PlayerId; onClose: () => void }) {
  const { setMode } = useGameStore();
  const me = game.players.find((p) => p.id === pid)!;
  const mine = Object.values(game.knights ?? {}).filter((k) => k.playerId === pid);
  const color = playerColorVar(me.color);
  return (
    <DialogShell title="Knights" onClose={onClose}>
      <div className="ck-stack">
        <div className="ck-row ck-soft" style={{ fontSize: '0.8em' }}>
          {([1, 2, 3] as KnightStrength[]).map((s) => (
            <span key={s} className="ck-row" title={`${KNIGHT_LABEL[s]}: strength ${s}`}>
              <svg width={22} height={22} viewBox="-12 -16 24 24" aria-hidden>
                <KnightGlyph color={color} strength={s} active />
              </svg>
              {mine.filter((k) => k.strength === s).length} on board · {supplyAvailable(game, pid, s)} left
            </span>
          ))}
        </div>
        <div className="ck-knight-actions">
          {knightOptions(game, pid).map((o) => (
            <button
              key={o.label}
              type="button"
              className="ck-knight-action"
              disabled={!!o.blocker}
              title={o.blocker ?? undefined}
              onClick={() => {
                setMode(o.mode);
                onClose();
              }}
            >
              <strong>{o.label}</strong>
              <span>{o.cost}</span>
              {o.blocker && <span className="ck-blocker">{o.blocker}</span>}
            </button>
          ))}
        </div>
        <p className="ck-soft" style={{ margin: 0 }}>
          Knights stand up when activated and lie down after an action. A knight activated this turn
          can't act until your next turn. Active knights defend against the barbarians.
        </p>
      </div>
    </DialogShell>
  );
}
