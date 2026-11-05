import { useGameStore } from '@/store/gameStore';
import { Button } from '@/ui/shared/Button';
import { RESOURCE_ICON } from '@/ui/shared/ResourceChip';
import { COSTS, RESOURCES } from '@/game/types';
import type { GameState, PlayerId, ResourceBank } from '@/game/types';
import { canAfford } from '@/game/resources';
import {
  destinationOf,
  driveOffTargets,
  legalWagonSteps,
  locationAtPlaza,
  wagonLevelInfo,
} from '@/game/modules/traders/tradersBarbarians/state';
import {
  TB_BOOST_COST,
  TB_BOOST_MP,
  TB_MAX_WAGON_LEVEL,
  TB_WAGON_UPGRADE_COSTS,
} from '@/game/modules/traders/tradersBarbarians/constants';
import { GOOD_LABEL, LOCATION_LABEL } from './TradersBarbariansArt';

// "Traders & Barbarians" scenario controls in the ActionBar: the wagon
// upgrade and the scenario's development card (Action phase), the End of
// Turn wagon bar (wheat boost, drive-offs, Swift Journey, Knight, Done) and
// the barbarian-placement prompt. The ActionBar only renders these for the
// acting seat's own device.

export function costText(cost: Partial<ResourceBank>): string {
  return RESOURCES.filter((r) => (cost[r] ?? 0) > 0)
    .map((r) => `${cost[r]}${RESOURCE_ICON[r]}`)
    .join(' ');
}

export function driveRange(min: number | null): string {
  if (min === null) return 'none';
  return min === 6 ? '6' : `${min}–6`;
}

// Level-up summary: what the next column of the wagon board gives.
export function upgradeSummary(level: number): string {
  const next = wagonLevelInfo(level + 1);
  return `${next.mp} MP, drive off barbarians on ${driveRange(next.driveOffMin)}, deliveries pay ${next.deliveryGold} gold${level + 1 === TB_MAX_WAGON_LEVEL ? ', +1 VP' : ''}`;
}

export function TradersBarbariansMainButtons({ game, acting }: { game: GameState; acting: PlayerId }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const tb = game.tradersBarbarians;
  const player = game.players.find((p) => p.id === acting);
  if (!tb || !player) return null;
  const wagon = tb.wagons[acting];
  const level = wagon?.level ?? 1;
  const maxed = level >= TB_MAX_WAGON_LEVEL;
  const cost = TB_WAGON_UPGRADE_COSTS[level];
  return (
    <>
      <Button
        disabled={!wagon || maxed || !cost || !canAfford(player.resources, cost)}
        onClick={() => dispatch({ type: 'upgradeWagon', playerId: acting })}
        title={
          maxed
            ? 'Your wagon is fully upgraded (+1 VP)'
            : `Upgrade your wagon to level ${level + 1} (${costText(cost ?? {})}): ${upgradeSummary(level)}`
        }
      >
        🛒 Wagon {maxed ? `L${level} ★` : `L${level}→${level + 1}`}
      </Button>
      <Button
        disabled={tb.deck.length === 0 || !canAfford(player.resources, COSTS.devCard)}
        onClick={() => dispatch({ type: 'buyDevCard', playerId: acting })}
        title={`Buy a development card (1🐑 1🌾 1🪨) — ${tb.deck.length} left: Knight (move a barbarian, rob the road it lands on), Road Building, Swift Journey (a second wagon move), Victory Point`}
      >
        🃏 Dev Card
      </Button>
    </>
  );
}

export function TradersBarbariansPhaseBar({ game, acting }: { game: GameState; acting: PlayerId }) {
  const { dispatch, uiMode, setMode } = useGameStore();
  const tb = game.tradersBarbarians;
  const player = game.players.find((p) => p.id === acting);
  if (!tb || !player) return null;

  if (game.phase === 'moveBarbarian') {
    const pending = tb.pendingBarbarian;
    if (!pending || pending.playerId !== acting) return null;
    const picked = pending.barbarian ?? (uiMode.kind === 'tbBarbarian' ? uiMode.pick : undefined);
    const why =
      pending.reason === 'seven' ? 'Rolled a 7' : pending.reason === 'knight' ? 'Knight' : 'Driven off!';
    const hint =
      pending.reason === 'driveOff'
        ? 'Put the barbarian on any edge without a barbarian (no robbing after a drive-off).'
        : picked === undefined
          ? 'Move a barbarian: pick one of the three, then an edge without a barbarian. Put it on a road (💰) to rob that road’s owner of 1 random card.'
          : 'Pick an edge without a barbarian for it. On a rival’s road (💰) you rob its owner of 1 random card.';
    return (
      <div className="actionbar">
        <div className="actionbar-hint actionbar-slot-wide">
          <strong>{why}</strong> — {hint}
        </div>
        {pending.barbarian === undefined && picked !== undefined && (
          <div className="actionbar-slot">
            <Button fullWidth onClick={() => setMode({ kind: 'tbBarbarian' })}>
              Pick another
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (game.phase !== 'wagonMoves') return null;
  const turn = tb.wagonTurn;
  const wagon = tb.wagons[acting];
  if (!turn || !wagon) return null;
  const info = wagonLevelInfo(wagon.level);
  const steps = legalWagonSteps(game, acting);
  const drive = driveOffTargets(game, acting);
  const at = locationAtPlaza(game, wagon.vertex);
  const sj = tb.swiftJourney[acting];
  const canSwift =
    (sj?.unplayed ?? 0) > 0 && !game.hasPlayedDevCardThisTurn && turn.moveAction === 1;
  const canKnight = !game.hasPlayedDevCardThisTurn && player.devCards.unplayed.includes('knight');
  const last = tb.lastEvents?.events.find((e) => e.kind === 'driveOff' && e.playerId === acting);
  const lastDrive =
    last && last.kind === 'driveOff' && tb.lastEvents?.events.length === 1
      ? last.success
        ? ''
        : ` 🎲 ${last.die}: the barbarian stays.`
      : '';
  let hint: string;
  if (turn.ended) {
    // What just happened at the plaza (the move that entered it).
    const events = tb.lastEvents?.events ?? [];
    const delivered = events.find((e) => e.kind === 'deliver' && e.playerId === acting);
    const emptyStack = events.some((e) => e.kind === 'stackEmpty' && e.playerId === acting);
    const parts = [`Your wagon reached the ${at ? LOCATION_LABEL[at.id].toLowerCase() : 'plaza'}: its move is over.`];
    if (delivered && delivered.kind === 'deliver') {
      parts.push(`📦 Delivered ${GOOD_LABEL[delivered.good].toLowerCase()}: +1 VP, +${delivered.gold} gold.`);
    }
    if (wagon.cargo) {
      parts.push(`Carrying ${GOOD_LABEL[wagon.cargo.good].toLowerCase()} for the ${LOCATION_LABEL[destinationOf(wagon.cargo.good)].toLowerCase()}.`);
    } else if (emptyStack) {
      parts.push('Its stack is empty.');
    }
    if (canSwift) parts.push('A Swift Journey would move you on.');
    hint = parts.join(' ');
  } else if (steps.length === 0) {
    hint = `${turn.mp} MP left — no edge you can afford.${lastDrive}`;
  } else {
    hint = `Move your wagon: ${turn.mp} MP left${turn.moveAction === 2 ? ' (Swift Journey)' : ''}. Click a highlighted intersection (numbers = MP, 🪙 = 1 gold toll). A plaza ends the move.${lastDrive}`;
  }
  const hasWheat = canAfford(player.resources, TB_BOOST_COST);
  return (
    <div className="actionbar">
      <div className="actionbar-hint actionbar-slot-wide">🛒 {hint}</div>
      <Button
        disabled={turn.ended || turn.boosted || !hasWheat}
        onClick={() => dispatch({ type: 'boostWagon', playerId: acting })}
        title={
          turn.boosted
            ? 'You already spent wheat on this move'
            : `Spend 1🌾 for +${TB_BOOST_MP} MP (once per move)`
        }
      >
        🌾 +{TB_BOOST_MP} MP
      </Button>
      {drive.map((i) => (
        <Button
          key={i}
          onClick={() => dispatch({ type: 'driveOffBarbarian', playerId: acting, barbarian: i })}
          title={`Try to drive off the barbarian next to your wagon: roll ${driveRange(info.driveOffMin)} on one die and you move it anywhere (once per barbarian per turn)`}
        >
          🎲 Drive off ({driveRange(info.driveOffMin)})
        </Button>
      ))}
      {canSwift && (
        <Button
          onClick={() => dispatch({ type: 'playSwiftJourney', playerId: acting })}
          title={`Swift Journey: end this move and take a second one with ${info.mp} MP`}
        >
          ⚡ Swift Journey
        </Button>
      )}
      {canKnight && (
        <Button
          onClick={() => dispatch({ type: 'playKnight', playerId: acting })}
          title="Knight: move a barbarian to any edge without one; on a road, rob its owner"
        >
          ⚔️ Knight
        </Button>
      )}
      <div className="actionbar-slot actionbar-slot-end">
        <Button
          variant="primary"
          fullWidth
          onClick={() => dispatch({ type: 'endTurn', playerId: acting })}
          title="Finish moving (unused MP are lost) and pass the turn"
        >
          Done ▸
        </Button>
      </div>
    </div>
  );
}
