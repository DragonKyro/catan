import type {
  GameState,
  RollDiceAction,
  Resource,
  Commodity,
  ResourceBank,
  CommodityBank,
  PlayerId,
  VertexId,
  EventDieFace,
} from '../../../types';
import { RESOURCES, COMMODITIES, EVENT_DIE_FACES, TERRAIN_TO_COMMODITY } from '../../../types';
import { currentPlayerId, updatePlayer } from '../../../helpers';
import {
  addResources,
  subtractResources,
  totalResources,
} from '../../../resources';
import {
  addCommodities,
  subtractCommodities,
  totalCommodities,
} from '../../../commodities';
import { rngInt } from '../../../rng';
import { advanceBarbarianShip, resolveBarbarianAttack } from '../barbarian';
import { aqueductActive } from '../improvements/state';
import { drawProgressCardsForEvent } from '../progress/draw';

// Cities & Knights `rollDice` override. The rulebook flow is:
//   1. (Optional progress card play — Alchemy. Not implemented in Phase 1.)
//   2. Roll 2 production dice + 1 event die.
//   3. Resolve event die FIRST (advance barbarian, or — Phase 8c — trigger
//      progress card draws).
//   4. Then resolve production: cities on wood/sheep/ore yield 1 resource +
//      1 commodity; cities on wheat/brick yield 2 of that resource;
//      settlements yield 1 as in base.
//   5. On a 7: discard (using combined resources+commodities + wall bonus),
//      then move robber — but only if the robber is "active" (first
//      barbarian attack has occurred).
export function handleRollDiceCK(state: GameState, action: RollDiceAction): GameState {
  if (state.phase !== 'rollOrPlayKnight') {
    throw new Error(`Cannot roll dice in phase ${state.phase}`);
  }
  if (state.hasRolledThisTurn) throw new Error('Already rolled this turn');
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');

  // Alchemy progress card: if the current player pre-played alchemy this
  // turn, override the action's dice with the chosen values.
  const [d1, d2] = state.pendingAlchemy ?? action.dice;
  if (d1 < 1 || d1 > 6 || d2 < 1 || d2 > 6) {
    throw new Error('Invalid dice values');
  }
  const total = d1 + d2;

  // Roll the event die from the seeded RNG. All peers reduce identically.
  const [eventIdx, rngAfterEvent] = rngInt(state.rngState, EVENT_DIE_FACES.length);
  const eventDie: EventDieFace = EVENT_DIE_FACES[eventIdx]!;

  let next: GameState = {
    ...state,
    rngState: rngAfterEvent,
    hasRolledThisTurn: true,
    lastRoll: { dice: [d1, d2], total, player: action.playerId },
    lastEventDie: eventDie,
    pendingAlchemy: undefined,
  };

  // Resolve the event die first (rulebook p.6 "Resolve the event die before
  // resolving the production dice").
  let barbarianAttackTriggered = false;
  if (eventDie === 'barbarian') {
    const advanced = advanceBarbarianShip(next);
    next = advanced.state;
    barbarianAttackTriggered = advanced.attacked;
  } else {
    // Improvement faces: each player whose track level is >= red die draws
    // a progress card of the matching deck. Threads RNG via next state.
    next = drawProgressCardsForEvent(next, eventDie, d1);
  }

  if (barbarianAttackTriggered) {
    next = resolveBarbarianAttack(next);
  }

  // Now resolve the production dice.
  if (total === 7) {
    return resolveSevenRoll(next);
  }

  next = distributeWithCommodities(next, total);

  // Aqueduct (science L3): any player at science >= 3 who received nothing
  // (no resources, no commodities) on this roll gets to pick 1 resource.
  const before = state.players;
  const after = next.players;
  const aqueductPending: PlayerId[] = [];
  for (let i = 0; i < before.length; i++) {
    const a = after.find((p) => p.id === before[i]!.id)!;
    const b = before[i]!;
    if (!aqueductActive(next, a.id)) continue;
    const gainedRes = totalResources(a.resources) - totalResources(b.resources);
    const gainedCom =
      totalCommodities(a.commodities ?? { paper: 0, cloth: 0, coin: 0 }) -
      totalCommodities(b.commodities ?? { paper: 0, cloth: 0, coin: 0 });
    if (gainedRes === 0 && gainedCom === 0) aqueductPending.push(a.id);
  }
  if (aqueductPending.length > 0) {
    // Order by player order starting from the current player.
    const ordered: PlayerId[] = [];
    const startIdx = state.currentPlayerIndex;
    for (let i = 0; i < state.playerOrder.length; i++) {
      const pid = state.playerOrder[(startIdx + i) % state.playerOrder.length]!;
      if (aqueductPending.includes(pid)) ordered.push(pid);
    }
    return {
      ...next,
      phase: 'aqueductPick',
      pendingAqueduct: ordered,
    };
  }

  return next;
}

function resolveSevenRoll(state: GameState): GameState {
  // Discard pass: each player with hand-size > (7 + 2*walls) discards half.
  const required: Record<PlayerId, number> = {};
  for (const p of state.players) {
    const handSize =
      totalResources(p.resources) + totalCommodities(p.commodities ?? { paper: 0, cloth: 0, coin: 0 });
    const threshold = 7 + 2 * (p.cityWalls ?? 0);
    if (handSize > threshold) required[p.id] = Math.floor(handSize / 2);
  }

  // If the robber isn't active yet (no barbarian attack has resolved), we
  // skip robber movement on 7s. Still resolve discards.
  const robberPhase: GameState['phase'] = state.robberActive
    ? 'moveRobber'
    : 'main';
  const pendingRobberMove = state.robberActive
    ? ({ reason: 'sevenRoll', returnTo: 'main' } as const)
    : undefined;

  if (Object.keys(required).length > 0) {
    return {
      ...state,
      phase: 'discard',
      discardState: { required },
      ...(pendingRobberMove ? { pendingRobberMove } : {}),
    };
  }
  return {
    ...state,
    phase: robberPhase,
    ...(pendingRobberMove ? { pendingRobberMove } : {}),
  };
}

// Cities & Knights production. Per rulebook p.7:
//   - Settlements yield 1 resource per adjacent producing hex.
//   - Cities yield 2 of (wheat / brick) when adjacent to those terrains.
//   - Cities yield 1 resource + 1 commodity when adjacent to wood / sheep /
//     ore (commodity = TERRAIN_TO_COMMODITY[terrain]).
//   - Desert / sea: no production.
//   - The hex carrying the robber doesn't produce.
//   - The bank-depletion rule applies independently to each resource and
//     each commodity (mirrors base game per-resource depletion).
export function distributeWithCommodities(
  state: GameState,
  rolled: number,
): GameState {
  type ResGrants = Record<Resource, number>;
  type ComGrants = Record<Commodity, number>;
  const resGrants = new Map<PlayerId, ResGrants>();
  const comGrants = new Map<PlayerId, ComGrants>();
  for (const p of state.players) {
    resGrants.set(p.id, { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
    comGrants.set(p.id, { paper: 0, cloth: 0, coin: 0 });
  }

  for (const hex of Object.values(state.board.hexes)) {
    if (hex.terrain === 'desert' || hex.terrain === 'sea') continue;
    if (hex.terrain === 'gold') continue; // No gold hexes in base C&K; safe to skip.
    if (hex.numberToken !== rolled) continue;
    if (hex.id === state.board.robberHex) continue;

    const corners: VertexId[] = [];
    for (const v of Object.values(state.board.vertices)) {
      if (v.hexes.includes(hex.id)) corners.push(v.id);
    }

    const resource = hex.terrain as Resource;
    const commodity = TERRAIN_TO_COMMODITY[resource];

    for (const vid of corners) {
      for (const p of state.players) {
        if (p.settlements.includes(vid)) {
          resGrants.get(p.id)![resource] += 1;
        } else if (p.cities.includes(vid)) {
          if (commodity) {
            // City on wood/sheep/ore: 1 resource + 1 commodity.
            resGrants.get(p.id)![resource] += 1;
            comGrants.get(p.id)![commodity] += 1;
          } else {
            // City on wheat/brick: 2 resource.
            resGrants.get(p.id)![resource] += 2;
          }
        }
      }
    }
  }

  // Bank depletion (resources) — copied from base distributeResources.
  for (const r of RESOURCES) {
    let demand = 0;
    let demanders = 0;
    for (const p of state.players) {
      const g = resGrants.get(p.id)![r];
      if (g > 0) {
        demand += g;
        demanders++;
      }
    }
    if (demand > state.bank[r]) {
      if (demanders > 1) {
        for (const p of state.players) resGrants.get(p.id)![r] = 0;
      } else {
        const inBank = state.bank[r];
        for (const p of state.players) {
          if (resGrants.get(p.id)![r] > 0) resGrants.get(p.id)![r] = inBank;
        }
      }
    }
  }

  // Bank depletion (commodities) — mirrors resource rule.
  const cBank = state.commodityBank ?? { paper: 0, cloth: 0, coin: 0 };
  for (const c of COMMODITIES) {
    let demand = 0;
    let demanders = 0;
    for (const p of state.players) {
      const g = comGrants.get(p.id)![c];
      if (g > 0) {
        demand += g;
        demanders++;
      }
    }
    if (demand > cBank[c]) {
      if (demanders > 1) {
        for (const p of state.players) comGrants.get(p.id)![c] = 0;
      } else {
        const inBank = cBank[c];
        for (const p of state.players) {
          if (comGrants.get(p.id)![c] > 0) comGrants.get(p.id)![c] = inBank;
        }
      }
    }
  }

  // Apply grants.
  let next: GameState = state;
  let resBankOut: Partial<ResourceBank> = {};
  let comBankOut: Partial<CommodityBank> = {};
  for (const p of state.players) {
    const rg = resGrants.get(p.id)!;
    const cg = comGrants.get(p.id)!;
    const anyR = Object.values(rg).some((v) => v > 0);
    const anyC = Object.values(cg).some((v) => v > 0);
    if (!anyR && !anyC) continue;
    next = updatePlayer(next, p.id, (pl) => ({
      ...pl,
      resources: anyR ? addResources(pl.resources, rg) : pl.resources,
      commodities: anyC
        ? addCommodities(pl.commodities ?? { paper: 0, cloth: 0, coin: 0 }, cg)
        : pl.commodities,
    }));
    for (const r of RESOURCES) {
      if (rg[r] > 0) resBankOut[r] = (resBankOut[r] ?? 0) + rg[r];
    }
    for (const c of COMMODITIES) {
      if (cg[c] > 0) comBankOut[c] = (comBankOut[c] ?? 0) + cg[c];
    }
  }
  next = {
    ...next,
    bank: subtractResources(next.bank, resBankOut),
    commodityBank: subtractCommodities(cBank, comBankOut),
  };

  return { ...next, phase: 'main' };
}
