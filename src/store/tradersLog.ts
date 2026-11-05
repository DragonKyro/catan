import type { Action, GameState, PlayerId, ResourceBank } from '@/game/types';

// Traders & Barbarians log lines for Rivers of Catan and Fishing on Catan,
// derived from the action plus a before / after diff so effects inside other
// actions (river gold on a road, a catch on a roll, a wealth tile changing
// hands) are logged on every path. Rendered like the Seafarers lines
// (`{ player, text, gained }`). Fish token values stay secret: catches and
// spends log counts / effects only.
export interface TradersLogLine {
  player: PlayerId | null;
  text: string;
  gained?: Partial<ResourceBank>;
}

const name = (s: GameState, pid: PlayerId) => s.players.find((p) => p.id === pid)?.name ?? pid;
const gold = (s: GameState, pid: PlayerId) => s.players.find((p) => p.id === pid)?.gold ?? 0;
const fishCount = (s: GameState, pid: PlayerId) =>
  s.players.find((p) => p.id === pid)?.fishTokens?.length ?? 0;

export function tradersLogLines(before: GameState, action: Action, after: GameState): TradersLogLine[] {
  if (!after.settings.expansions.includes('traders')) return [];
  const out: TradersLogLine[] = [];
  const me = action.playerId;

  switch (action.type) {
    case 'buildBridge':
      out.push({ player: me, text: 'built a bridge (+3 gold)' });
      break;
    case 'spendGold':
      out.push({ player: me, text: 'paid 2 gold for', gained: { [action.resource]: 1 } });
      break;
    case 'buyGold': {
      const paid = before.players.find((p) => p.id === me)!.resources[action.give] -
        after.players.find((p) => p.id === me)!.resources[action.give];
      out.push({ player: me, text: `bought 1 gold with ${paid} ${action.give}` });
      break;
    }
    case 'spendFish': {
      const fx = action.effect;
      const text =
        fx.kind === 'removeRobber'
          ? 'spent fish to remove the robber from the board'
          : fx.kind === 'steal'
            ? `spent fish to steal a card from ${name(after, fx.target)}`
            : fx.kind === 'takeFromBank'
              ? 'spent fish to take'
              : fx.kind === 'buildRoad'
                ? 'spent fish to build a road'
                : 'spent fish to take a development card';
      out.push({
        player: me,
        text,
        ...(fx.kind === 'takeFromBank' ? { gained: { [fx.resource]: 1 } } : {}),
      });
      break;
    }
    case 'passOldBoot':
      out.push({ player: me, text: `passed the old boot to ${name(after, action.to)}` });
      break;
    case 'swapFish':
      out.push({
        player: me,
        text: action.token ? 'swapped a fish token for a new one' : 'kept a full fish hand',
      });
      break;
    default:
      break;
  }

  // River gold earned on a road / settlement (setup included). Bridges and
  // coin trades are logged above.
  if (action.type !== 'buildBridge' && action.type !== 'buyGold' && action.type !== 'spendGold') {
    for (const p of after.players) {
      const d = gold(after, p.id) - gold(before, p.id);
      if (d > 0) out.push({ player: p.id, text: `earned ${d} gold building on a river tile` });
    }
  }

  // Fish caught (production, or a second starting settlement).
  if (action.type === 'rollDice' || action.type === 'placeInitialSettlement') {
    for (const p of after.players) {
      const d = fishCount(after, p.id) - fishCount(before, p.id);
      if (d > 0) out.push({ player: p.id, text: `caught ${d} fish token${d === 1 ? '' : 's'}` });
    }
    if (after.fishSwap && !before.fishSwap) {
      for (const pid of after.fishSwap.queue) {
        out.push({ player: pid, text: 'has a full fish hand (7 tokens)' });
      }
    }
  }
  if (after.oldBootHolder && !before.oldBootHolder) {
    out.push({ player: after.oldBootHolder, text: 'drew the old boot: now needs 1 more VP to win' });
  }

  // Wealth status.
  const bw = before.wealthTiles;
  const aw = after.wealthTiles;
  if (bw && aw) {
    if (aw.wealthiest !== bw.wealthiest) {
      if (aw.wealthiest) out.push({ player: aw.wealthiest, text: 'is now the Wealthiest Catanian (+1 VP)' });
      else out.push({ player: null, text: 'Nobody is the Wealthiest Catanian (tie for the most gold)' });
    }
    for (const pid of aw.poor) {
      if (!bw.poor.includes(pid)) out.push({ player: pid, text: 'took a Poor Catanian tile (−2 VP)' });
    }
    for (const pid of bw.poor) {
      if (!aw.poor.includes(pid)) out.push({ player: pid, text: 'returned their Poor Catanian tile' });
    }
  }
  return out;
}
