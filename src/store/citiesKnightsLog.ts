import type { Action, GameState, ImprovementTrack, PlayerId } from '@/game/types';
import { COMMODITIES, IMPROVEMENT_TRACKS, RESOURCES } from '@/game/types';
import { CITIES_AND_KNIGHTS_EXPANSION_ID, KNIGHT_LABEL, TRACK_LABEL } from '@/game/modules/citiesAndKnights/constants';
import { PROGRESS_CARD_LABEL } from '@/game/modules/citiesAndKnights/progress/catalogue';
import { BARBARIAN_TRACK_LENGTH } from '@/game/modules/citiesAndKnights/constants';

// Cities & Knights log lines, derived from the action plus a before/after
// diff so effects inside other actions (an attack inside a roll, cards
// moved by a progress card, a pillage choice) are logged on every path.
// Hidden information stays hidden: which progress card someone drew or
// took is never named (VP cards are face up, so those are).
export interface CitiesKnightsLogLine {
  player: PlayerId | null;
  text: string;
}

const EVENT_TEXT: Record<string, string> = {
  barbarian: 'a barbarian ship ⛵',
  science: 'the science icon',
  trade: 'the trade icon',
  politics: 'the politics icon',
};

function name(state: GameState, pid: PlayerId): string {
  return state.players.find((p) => p.id === pid)?.name ?? pid;
}

function handCount(state: GameState, pid: PlayerId): number {
  const p = state.players.find((x) => x.id === pid);
  if (!p) return 0;
  const h = p.progressCards ?? { science: [], trade: [], politics: [] };
  return h.science.length + h.trade.length + h.politics.length;
}

function deckGain(before: GameState, after: GameState, pid: PlayerId): ImprovementTrack[] {
  const b = before.players.find((p) => p.id === pid)?.progressCards;
  const a = after.players.find((p) => p.id === pid)?.progressCards;
  const out: ImprovementTrack[] = [];
  for (const t of IMPROVEMENT_TRACKS) {
    const d = (a?.[t].length ?? 0) - (b?.[t].length ?? 0);
    for (let i = 0; i < d; i++) out.push(t);
  }
  return out;
}

function cardsDelta(before: GameState, after: GameState, pid: PlayerId): string {
  const b = before.players.find((p) => p.id === pid)!;
  const a = after.players.find((p) => p.id === pid)!;
  const parts: string[] = [];
  for (const r of RESOURCES) {
    const d = a.resources[r] - b.resources[r];
    if (d > 0) parts.push(`${d} ${r}`);
  }
  for (const c of COMMODITIES) {
    const d = (a.commodities?.[c] ?? 0) - (b.commodities?.[c] ?? 0);
    if (d > 0) parts.push(`${d} ${c}`);
  }
  return parts.join(', ');
}

function cardsCountDelta(before: GameState, after: GameState, pid: PlayerId): number {
  const tot = (s: GameState) => {
    const p = s.players.find((x) => x.id === pid)!;
    let n = 0;
    for (const r of RESOURCES) n += p.resources[r];
    for (const c of COMMODITIES) n += p.commodities?.[c] ?? 0;
    return n;
  };
  return tot(after) - tot(before);
}

export function citiesKnightsLogLines(
  before: GameState,
  action: Action,
  after: GameState,
): CitiesKnightsLogLine[] {
  if (!after.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID)) return [];
  const out: CitiesKnightsLogLine[] = [];
  const me = action.playerId;
  const add = (player: PlayerId | null, text: string) => out.push({ player, text });

  // ----- Roll: event die, barbarians, draws -----
  if (action.type === 'rollDice' && after.lastEventDie) {
    add(null, `🎲 Event die: ${EVENT_TEXT[after.lastEventDie]}`);
    if (before.pendingAlchemy) add(me, `used Alchemy: the dice were set to ${after.lastRoll?.dice.join(' + ')}`);
    const bb = before.barbarian;
    const ab = after.barbarian;
    if (bb && ab && ab.attacksResolved === bb.attacksResolved && ab.position > bb.position) {
      add(null, `⛵ The barbarians sail closer (${ab.position}/${BARBARIAN_TRACK_LENGTH})`);
    }
  }
  if (before.barbarian && after.barbarian && after.barbarian.attacksResolved > before.barbarian.attacksResolved) {
    const atk = after.lastBarbarianAttack;
    if (atk) {
      if (atk.outcome === 'defended') {
        add(null, `⚔ The barbarians attack: ${atk.barbarianStrength} against ${atk.defenderStrength} knights — Catan is defended!`);
        if (atk.defender) add(atk.defender, 'takes a Defender of Catan VP token (+1 VP)');
        if (atk.tied?.length) {
          add(null, `${atk.tied.map((p) => name(after, p)).join(' & ')} tied for the best defense: each draws a progress card`);
        }
      } else {
        add(null, `⚔ The barbarians attack: ${atk.barbarianStrength} against ${atk.defenderStrength} knights — they pillage!`);
      }
      add(null, 'All knights are laid down');
    }
  }
  // Cities reduced (attack with one city, or a pillage choice).
  for (const bp of before.players) {
    const ap = after.players.find((p) => p.id === bp.id)!;
    for (const v of bp.cities) {
      if (!ap.cities.includes(v) && ap.settlements.includes(v)) {
        const wall = before.cityWalls?.[v] === bp.id;
        add(bp.id, `loses a city to the barbarians — it's a settlement again${wall ? ' (its wall is lost)' : ''}`);
      }
    }
  }

  // Progress card draws (event die, defender tie) — deck only, never the card.
  for (const p of after.players) {
    const decks = deckGain(before, after, p.id);
    const vpBefore = before.players.find((x) => x.id === p.id)?.progressVpCards ?? [];
    const vpAfter = p.progressVpCards ?? [];
    const fromAction =
      action.type === 'chooseProgressCardPick' || action.type === 'playProgressCard';
    if (!fromAction) {
      for (const t of decks) add(p.id, `draws a ${TRACK_LABEL[t].toLowerCase()} progress card`);
    }
    for (const c of vpAfter.slice(vpBefore.length)) {
      add(p.id, `reveals ${PROGRESS_CARD_LABEL[c].replace(' (VP)', '')}: +1 VP, face up`);
    }
  }

  // Metropolis changes hands.
  for (const t of IMPROVEMENT_TRACKS) {
    const b = before.metropolises?.[t];
    const a = after.metropolises?.[t];
    if (a && (!b || b.playerId !== a.playerId)) {
      add(
        a.playerId,
        `takes the ${TRACK_LABEL[t].toLowerCase()} metropolis${b ? ` from ${name(after, b.playerId)}` : ''}${a.permanent ? ' for good' : ''} (+2 VP)`,
      );
    } else if (a && b && a.permanent && !b.permanent) {
      add(a.playerId, `makes the ${TRACK_LABEL[t].toLowerCase()} metropolis permanent`);
    }
  }

  // Merchant changes hands.
  if (after.merchant && (before.merchant?.ownerId !== after.merchant.ownerId || before.merchant.hexId !== after.merchant.hexId)) {
    const hex = after.board.hexes[after.merchant.hexId];
    add(after.merchant.ownerId, `places the merchant on a ${hex?.terrain ?? ''} hex (+1 VP, 2:1 there)`);
  }

  switch (action.type) {
    case 'discardProgressCard':
      add(me, `discards a ${TRACK_LABEL[action.deck].toLowerCase()} progress card`);
      break;
    case 'aqueductPick':
      add(me, `takes 1 ${action.resource} (Aqueduct)`);
      break;
    case 'defenderTieDraw':
      break;
    case 'choosePillagedCity':
      break;
    case 'promoteKnight': {
      const k = after.knights?.[action.vertex];
      if (k) add(me, `promotes a knight to ${KNIGHT_LABEL[k.strength].toLowerCase()}`);
      break;
    }
    case 'displacedKnightMove':
      add(me, 'moves the displaced knight');
      break;
    case 'displaceKnight':
    case 'playProgressCard': {
      // A displaced knight with nowhere to go goes back to its owner's supply.
      if (action.type === 'playProgressCard' && action.card !== 'intrigue') break;
      if (after.phase === 'displacedKnightMove') break;
      const victim = action.type === 'displaceKnight' ? before.knights?.[action.to] : before.knights?.[action.vertex ?? ''];
      if (victim) add(victim.playerId, 'loses the displaced knight: it had nowhere to go (back to the supply)');
      break;
    }
    case 'bankTradeCK':
      add(me, `trades with the supply: ${cardsDelta(after, before, me) || '…'} → ${cardsDelta(before, after, me) || '…'}`);
      break;
    case 'commercialHarborOffer':
      if (action.commodity) {
        add(me, `hands a commodity to ${name(after, before.pendingCommercialHarbor!.offererId)} for a resource (Commercial Harbor)`);
      }
      break;
    case 'commercialHarborPropose':
      if (after.phase !== 'commercialHarborOffer') {
        add(action.targetId, 'has no commodity: the Commercial Harbor offer goes back');
      }
      break;
    case 'weddingGive':
      add(me, `gives ${name(after, before.pendingWedding!.collector)} ${cardsCountDelta(after, before, me)} cards (Wedding)`);
      break;
    case 'chooseProgressCardPick': {
      const ctx = before.progressPickState;
      if (ctx?.kind === 'espionage') {
        add(me, handCount(after, me) > handCount(before, me) ? `takes a progress card from ${name(after, ctx.targetId)}` : `takes nothing from ${name(after, ctx.targetId)}`);
      } else if (ctx?.kind === 'guildDues') {
        add(me, `takes ${cardsCountDelta(before, after, me)} cards from ${name(after, ctx.targetId)}`);
      }
      break;
    }
    case 'treasonRemoveKnight':
      add(me, 'removes a knight (Treason)');
      break;
    case 'treasonPlaceKnight':
      add(me, action.vertex ? 'places a knight (Treason)' : 'places no knight');
      break;
    case 'removeRoad':
      add(me, `removes an open road (Diplomacy)${after.diplomacyFreeRoad ? ' of their own — the next road is free' : ''}`);
      break;
    case 'moveRobber':
      if (before.pendingRobberMove?.reason === 'taxation') {
        const n = cardsCountDelta(before, after, me);
        add(me, `taxes the players on that hex: ${n} card${n === 1 ? '' : 's'}`);
      }
      break;
    default:
      break;
  }

  // Effects of a played progress card.
  if (action.type === 'playProgressCard') {
    switch (action.card) {
      case 'irrigation':
      case 'mining':
      case 'resourceMonopoly':
      case 'tradeMonopoly': {
        const got = cardsDelta(before, after, me);
        add(me, got ? `collects ${got}` : 'collects nothing');
        break;
      }
      case 'invention':
        add(
          me,
          `swaps the ${before.board.hexes[action.fromHex!]?.numberToken} and the ${before.board.hexes[action.toHex!]?.numberToken}`,
        );
        break;
      case 'merchantFleet':
        add(me, `may trade ${action.resource ?? action.commodity} 2:1 this turn`);
        break;
      case 'encouragement':
        add(me, 'activates all their knights');
        break;
      case 'sabotage': {
        const hit = Object.keys(after.discardState?.required ?? {});
        add(me, hit.length > 0 ? `sabotages ${hit.map((p) => name(after, p)).join(', ')}` : 'sabotages nobody');
        break;
      }
      case 'diplomacy':
        if (after.phase !== 'removeRoad') add(me, 'finds no open road');
        break;
      default:
        break;
    }
  }
  return out;
}
