import type {
  GameState,
  RollDiceAction,
  Resource,
  ResourceBank,
  PlayerId,
  VertexId,
} from '../types';
import { RESOURCES } from '../types';
import { currentPlayerId, updatePlayer } from '../helpers';
import {
  addResources,
  subtractResources,
  totalResources,
} from '../resources';
import { robberOrPirateChoicePhase } from '../modules/seafarers/routing';
import { rngInt } from '../rng';

export function handleRollDice(state: GameState, action: RollDiceAction): GameState {
  if (state.phase !== 'rollOrPlayKnight') {
    throw new Error(`Cannot roll dice in phase ${state.phase}`);
  }
  if (state.hasRolledThisTurn) throw new Error('Already rolled this turn');
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');

  const [d1, d2] = action.dice;
  if (d1 < 1 || d1 > 6 || d2 < 1 || d2 > 6) {
    throw new Error('Invalid dice values');
  }
  const total = d1 + d2;

  const next: GameState = {
    ...state,
    hasRolledThisTurn: true,
    lastRoll: { dice: action.dice, total, player: action.playerId },
  };

  if (total === 7) {
    const required: Record<PlayerId, number> = {};
    for (const p of state.players) {
      const count = totalResources(p.resources);
      if (count > 7) required[p.id] = Math.floor(count / 2);
    }
    if (Object.keys(required).length > 0) {
      return {
        ...next,
        phase: 'discard',
        discardState: { required },
        pendingRobberMove: { reason: 'sevenRoll', returnTo: 'main' },
      };
    }
    return {
      ...next,
      phase: robberOrPirateChoicePhase(next),
      pendingRobberMove: { reason: 'sevenRoll', returnTo: 'main' },
    };
  }

  const afterProduction = distributeResources(next, total);
  return maybeEruptVolcano(afterProduction, total);
}

// Volcano scenario: if the volcano hex's number was rolled, pick a random
// occupied vertex among the volcano's six corners and destroy/downgrade the
// building there. Cities downgrade to settlements; settlements vanish. No
// resource refund. Uses the seeded `state.rngState` so all peers reduce
// identically.
function maybeEruptVolcano(state: GameState, rolled: number): GameState {
  const volcanoHexId = state.board.volcanoHex;
  if (!volcanoHexId) return state;
  const hex = state.board.hexes[volcanoHexId];
  if (!hex || hex.numberToken !== rolled) return state;

  const corners = hex.corners;
  // Collect (playerIndex, kind, vertexId) tuples for occupied corners.
  const occupied: Array<{
    playerId: PlayerId;
    kind: 'settlement' | 'city';
    vertexId: VertexId;
  }> = [];
  for (const vid of corners) {
    for (const p of state.players) {
      if (p.settlements.includes(vid)) {
        occupied.push({ playerId: p.id, kind: 'settlement', vertexId: vid });
      } else if (p.cities.includes(vid)) {
        occupied.push({ playerId: p.id, kind: 'city', vertexId: vid });
      }
    }
  }
  if (occupied.length === 0) return state;

  const [idx, nextRng] = rngInt(state.rngState, occupied.length);
  const target = occupied[idx]!;
  let next: GameState = { ...state, rngState: nextRng };
  if (target.kind === 'settlement') {
    next = updatePlayer(next, target.playerId, (p) => ({
      ...p,
      settlements: p.settlements.filter((v) => v !== target.vertexId),
    }));
  } else {
    // Downgrade: remove from cities, restore to settlements.
    next = updatePlayer(next, target.playerId, (p) => ({
      ...p,
      cities: p.cities.filter((v) => v !== target.vertexId),
      settlements: [...p.settlements, target.vertexId],
    }));
  }
  return next;
}

function distributeResources(state: GameState, rolled: number): GameState {
  type Grants = Record<Resource, number>;
  const grants = new Map<PlayerId, Grants>();
  // Per-player count of "gold picks" earned this roll (settlement=1, city=2 per
  // adjacent gold hex matching the rolled number). Always zero on the base
  // board because there are no gold hexes there.
  const goldPicks: Record<PlayerId, number> = {};
  // Cloth tokens earned this roll (Cloth for Catan). Settlements yield 1,
  // cities 2 per adjacent cloth hex matching the roll.
  const clothGrants: Record<PlayerId, number> = {};
  for (const p of state.players) {
    grants.set(p.id, emptyGrants());
    goldPicks[p.id] = 0;
    clothGrants[p.id] = 0;
  }
  const clothHexes = new Set(state.clothHexes ?? []);

  for (const hex of Object.values(state.board.hexes)) {
    if (hex.terrain === 'desert' || hex.terrain === 'sea') continue;
    if (hex.numberToken !== rolled) continue;
    if (hex.id === state.board.robberHex) continue;

    const corners: VertexId[] = [];
    for (const v of Object.values(state.board.vertices)) {
      if (v.hexes.includes(hex.id)) corners.push(v.id);
    }

    // Cloth hex: produces cloth instead of its terrain's resource. The
    // check comes before the gold and resource branches so a cloth hex
    // overrides whatever else the terrain would suggest.
    if (clothHexes.has(hex.id)) {
      for (const vid of corners) {
        for (const p of state.players) {
          if (p.settlements.includes(vid)) clothGrants[p.id] += 1;
          else if (p.cities.includes(vid)) clothGrants[p.id] += 2;
        }
      }
      continue;
    }

    if (hex.terrain === 'gold') {
      for (const vid of corners) {
        for (const p of state.players) {
          if (p.settlements.includes(vid)) goldPicks[p.id] += 1;
          else if (p.cities.includes(vid)) goldPicks[p.id] += 2;
        }
      }
      continue;
    }

    const resource = hex.terrain as Resource;
    for (const vid of corners) {
      for (const p of state.players) {
        if (p.settlements.includes(vid)) grants.get(p.id)![resource] += 1;
        else if (p.cities.includes(vid)) grants.get(p.id)![resource] += 2;
      }
    }
  }

  // Bank-depletion rule: if total demand for a resource exceeds bank supply AND
  // more than one player has demand, no one gets that resource. If only one
  // player has demand, they get whatever's left in the bank.
  for (const r of RESOURCES) {
    let demand = 0;
    let demanders = 0;
    for (const p of state.players) {
      const g = grants.get(p.id)![r];
      if (g > 0) {
        demand += g;
        demanders++;
      }
    }
    if (demand > state.bank[r]) {
      if (demanders > 1) {
        for (const p of state.players) grants.get(p.id)![r] = 0;
      } else {
        const inBank = state.bank[r];
        for (const p of state.players) {
          if (grants.get(p.id)![r] > 0) grants.get(p.id)![r] = inBank;
        }
      }
    }
  }

  // Apply grants
  let next: GameState = state;
  let bankOut: Partial<ResourceBank> = {};
  for (const p of state.players) {
    const g = grants.get(p.id)!;
    if (Object.values(g).every((v) => v === 0)) continue;
    next = updatePlayer(next, p.id, (pl) => ({
      ...pl,
      resources: addResources(pl.resources, g),
    }));
    for (const r of RESOURCES) {
      if (g[r] > 0) bankOut[r] = (bankOut[r] ?? 0) + g[r];
    }
  }
  next = { ...next, bank: subtractResources(next.bank, bankOut) };

  // Cloth for Catan: apply cloth grants. Cloth lives on player.cloth as a
  // simple counter — it doesn't deplete a bank pool (the rulebook treats
  // each cloth island as having unlimited tokens to give while production
  // hits).
  for (const p of state.players) {
    const c = clothGrants[p.id] ?? 0;
    if (c <= 0) continue;
    next = updatePlayer(next, p.id, (pl) => ({
      ...pl,
      cloth: (pl.cloth ?? 0) + c,
    }));
  }

  // Seafarers: if any player earned gold picks this roll, transition to the
  // chooseGoldResource phase. They each get N "any resource" picks; the phase
  // resolves once every pending player has dispatched chooseGoldResource.
  const pendingGold: Record<PlayerId, number> = {};
  for (const id of Object.keys(goldPicks)) {
    if (goldPicks[id]! > 0) pendingGold[id] = goldPicks[id]!;
  }
  if (Object.keys(pendingGold).length > 0) {
    return {
      ...next,
      phase: 'chooseGoldResource',
      goldChoiceState: { pending: pendingGold },
    };
  }

  return { ...next, phase: 'main' };
}

function emptyGrants(): Record<Resource, number> {
  return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
}
