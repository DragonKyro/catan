// What a move changed that's worth a short animation, worked out from the
// game before and after it (pure; BoardAnimations turns it into motion).
//
//   produce  cards a roll paid: one per player, card kind and hex (null when
//            the hex can't be told, e.g. a card from the bank)
//   build    a new settlement, city, road or ship on the board
//   devBuy   a development card bought (face down)
//   devPlay  a development / progress card played (face up)
//   award    Longest Road / Largest Army changing hands

import type { Action, Commodity, EdgeId, GameState, HexId, PlayerId, Resource, VertexId } from '@/game/types';
import { COMMODITIES, RESOURCES, TERRAIN_TO_COMMODITY } from '@/game/types';
import { hexRollsOn } from '@/game/board/hexNumbers';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import { PROGRESS_CARD_LABEL } from '@/game/modules/citiesAndKnights/progress/catalogue';
import { DEV_ICON, DEV_LABEL } from '@/ui/shared/DevCardChip';

export type CardKind = { resource: Resource } | { commodity: Commodity };

export type BoardEvent =
  | { kind: 'produce'; playerId: PlayerId; card: CardKind; count: number; hex: HexId | null }
  | { kind: 'build'; playerId: PlayerId; piece: 'settlement' | 'city'; vertex: VertexId }
  | { kind: 'build'; playerId: PlayerId; piece: 'road' | 'ship'; edge: EdgeId }
  | { kind: 'devBuy'; playerId: PlayerId }
  | { kind: 'devPlay'; playerId: PlayerId; icon: string; label: string }
  | { kind: 'award'; award: 'longestRoad' | 'largestArmy'; from: PlayerId | null; to: PlayerId | null };

const DEV_PLAYS: Partial<Record<Action['type'], keyof typeof DEV_LABEL>> = {
  playKnight: 'knight',
  playRoadBuilding: 'roadBuilding',
  playYearOfPlenty: 'yearOfPlenty',
  playMonopoly: 'monopoly',
};

export function deriveBoardEvents(before: GameState, action: Action, after: GameState): BoardEvent[] {
  const out: BoardEvent[] = [];
  // A roll's production (a 7 pays nothing).
  if (action.type === 'rollDice' && after.lastRoll && after.lastRoll !== before.lastRoll && after.lastRoll.total !== 7) {
    out.push(...production(before, after, after.lastRoll.total));
  }
  // New pieces on the board.
  for (const p of after.players) {
    const b = before.players.find((x) => x.id === p.id);
    if (!b) continue;
    for (const v of added(b.cities, p.cities)) out.push({ kind: 'build', playerId: p.id, piece: 'city', vertex: v });
    // A city knocked back to a settlement (Volcano, pillage) isn't a new build.
    for (const v of added(b.settlements, p.settlements)) {
      if (!b.cities.includes(v)) out.push({ kind: 'build', playerId: p.id, piece: 'settlement', vertex: v });
    }
    for (const e of added(b.roads, p.roads)) out.push({ kind: 'build', playerId: p.id, piece: 'road', edge: e });
    for (const e of added(b.ships ?? [], p.ships ?? [])) out.push({ kind: 'build', playerId: p.id, piece: 'ship', edge: e });
  }
  // Development cards.
  if (action.type === 'buyDevCard' && after.devCardDeck.length < before.devCardDeck.length) {
    out.push({ kind: 'devBuy', playerId: action.playerId });
  }
  const dev = DEV_PLAYS[action.type];
  if (dev) out.push({ kind: 'devPlay', playerId: action.playerId, icon: DEV_ICON[dev], label: DEV_LABEL[dev] });
  if (action.type === 'playProgressCard') {
    out.push({ kind: 'devPlay', playerId: action.playerId, icon: '📜', label: PROGRESS_CARD_LABEL[action.card] });
  }
  // Longest Road / Largest Army changing hands.
  for (const award of ['longestRoad', 'largestArmy'] as const) {
    const from = before[award]?.holder ?? null;
    const to = after[award]?.holder ?? null;
    if (from !== to) out.push({ kind: 'award', award, from, to });
  }
  return out;
}

function added<T>(before: readonly T[], after: readonly T[]): T[] {
  if (after.length === 0) return [];
  const had = new Set(before);
  return after.filter((x) => !had.has(x));
}

/**
 * Cards a roll paid each player, traced back to the hexes that produced them:
 * hexes with the number (not under the robber) of the card's terrain, next
 * to the player's buildings, each good for its buildings' share. Whatever's
 * left (a short bank, an event card, gold) comes from no particular hex.
 */
function production(before: GameState, after: GameState, total: number): BoardEvent[] {
  const out: BoardEvent[] = [];
  const robber = after.robberActive === false ? null : after.board.robberHex;
  const ck = after.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID);
  const rolled = Object.values(after.board.hexes).filter((h) => h.id !== robber && hexRollsOn(h, total));
  for (const p of after.players) {
    const b = before.players.find((x) => x.id === p.id);
    if (!b) continue;
    const share = (hexCorners: readonly VertexId[], cityWeight: number) => {
      let n = 0;
      for (const v of hexCorners) {
        if (b.settlements.includes(v)) n += 1;
        else if (b.cities.includes(v)) n += cityWeight;
      }
      return n;
    };
    const trace = (card: CardKind, gained: number, hexes: { id: HexId; n: number }[]) => {
      let left = gained;
      for (const h of hexes) {
        if (left <= 0) break;
        const n = Math.min(left, h.n);
        if (n > 0) out.push({ kind: 'produce', playerId: p.id, card, count: n, hex: h.id });
        left -= n;
      }
      if (left > 0) out.push({ kind: 'produce', playerId: p.id, card, count: left, hex: null });
    };
    for (const r of RESOURCES) {
      const gained = p.resources[r] - b.resources[r];
      if (gained <= 0) continue;
      // C&K cities make 1 resource + 1 commodity on forest / pasture / mountains, 2 elsewhere.
      const cityWeight = ck && TERRAIN_TO_COMMODITY[r] ? 1 : 2;
      const hexes = rolled.filter((h) => h.terrain === r).map((h) => ({ id: h.id, n: share(h.corners, cityWeight) }));
      trace({ resource: r }, gained, hexes);
    }
    if (p.commodities && b.commodities) {
      for (const c of COMMODITIES) {
        const gained = p.commodities[c] - b.commodities[c];
        if (gained <= 0) continue;
        const hexes = rolled
          .filter((h) => TERRAIN_TO_COMMODITY[h.terrain as Resource] === c)
          .map((h) => ({ id: h.id, n: h.corners.filter((v) => b.cities.includes(v)).length }));
        trace({ commodity: c }, gained, hexes);
      }
    }
  }
  return out;
}
