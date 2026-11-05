import type { Action, GameState, PlayerId, TbEvent } from '@/game/types';
import { destinationOf } from '@/game/modules/traders/tradersBarbarians/state';
import { TB_MAX_WAGON_LEVEL } from '@/game/modules/traders/tradersBarbarians/constants';

// "Traders & Barbarians" scenario log lines, read from the events the
// engine records on the action that produced them
// (`tradersBarbarians.lastEvents`, new when its `seq` changes): 2 / 12
// re-rolls, barbarian moves and robberies, drive-off rolls, tolls,
// deliveries and pick-ups, upgrades, wheat boosts, Swift Journeys and the
// wagon's move summary.

export interface TradersBarbariansLogLine {
  player: PlayerId | null;
  text: string;
}

const GOOD: Record<string, string> = { sand: 'sand', marble: 'marble', tools: 'tools', glass: 'glass' };
const PLACE: Record<string, string> = { quarry: 'quarry', castle: 'castle', glassworks: 'glassworks' };

function name(game: GameState, pid: PlayerId): string {
  return game.players.find((p) => p.id === pid)?.name ?? pid;
}

export function tbEventLine(game: GameState, e: TbEvent): TradersBarbariansLogLine | null {
  switch (e.kind) {
    case 'reroll': {
      const was = e.rerolled.map(([a, b]) => a + b).join(', ');
      return { player: e.playerId, text: `🎲 ${was} re-rolled → ${e.dice[0] + e.dice[1]}` };
    }
    case 'barbarianMoved': {
      const why = e.reason === 'seven' ? '(7)' : e.reason === 'knight' ? '(Knight)' : '(driven off)';
      const where = e.victim
        ? e.stole
          ? ` onto ${name(game, e.victim)}'s road and robbed 1 card`
          : ` onto ${name(game, e.victim)}'s road (no card to rob)`
        : '';
      return { player: e.playerId, text: `🪓 moved a barbarian ${why}${where}` };
    }
    case 'driveOff':
      return {
        player: e.playerId,
        text: e.success
          ? `🎲 drive-off roll ${e.die}: the barbarian is driven off!`
          : `🎲 drive-off roll ${e.die}: the barbarian stays`,
      };
    case 'toll':
      return { player: e.playerId, text: `🪙 paid ${name(game, e.owner)} 1 gold to use their road` };
    case 'deliver':
      return {
        player: e.playerId,
        text: `📦 delivered ${GOOD[e.good]} to the ${PLACE[e.location]}: +1 VP, +${e.gold} gold`,
      };
    case 'pickUp':
      return {
        player: e.playerId,
        text: `🛒 picked up ${GOOD[e.good]} at the ${PLACE[e.location]} (for the ${PLACE[destinationOf(e.good)]})`,
      };
    case 'stackEmpty':
      return { player: e.playerId, text: `the ${PLACE[e.location]} has no tokens left to pick up` };
    case 'upgrade':
      return {
        player: e.playerId,
        text: `🛒 upgraded their wagon to level ${e.level}${e.level >= TB_MAX_WAGON_LEVEL ? ' (fully upgraded: +1 VP)' : ''}`,
      };
    case 'boost':
      return { player: e.playerId, text: '🌾 spent 1 wheat: +2 MP' };
    case 'swiftJourney':
      return { player: e.playerId, text: '⚡ played Swift Journey: a second wagon move' };
    case 'wagonDone':
      return e.steps > 0
        ? { player: e.playerId, text: `🛒 moved their wagon ${e.steps} edge${e.steps === 1 ? '' : 's'}` }
        : null;
  }
}

export function tradersBarbariansLogLines(
  before: GameState,
  _action: Action,
  after: GameState,
): TradersBarbariansLogLine[] {
  const tb = after.tradersBarbarians;
  if (!tb || !before.tradersBarbarians) return [];
  if (!tb.lastEvents || tb.lastEvents.seq === before.tradersBarbarians.lastEvents?.seq) return [];
  const out: TradersBarbariansLogLine[] = [];
  for (const e of tb.lastEvents.events) {
    const line = tbEventLine(after, e);
    if (line) out.push(line);
  }
  return out;
}
