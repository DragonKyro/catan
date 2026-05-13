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
      phase: 'moveRobber',
      pendingRobberMove: { reason: 'sevenRoll', returnTo: 'main' },
    };
  }

  return distributeResources(next, total);
}

function distributeResources(state: GameState, rolled: number): GameState {
  type Grants = Record<Resource, number>;
  const grants = new Map<PlayerId, Grants>();
  for (const p of state.players) grants.set(p.id, emptyGrants());

  for (const hex of Object.values(state.board.hexes)) {
    if (hex.terrain === 'desert') continue;
    if (hex.numberToken !== rolled) continue;
    if (hex.id === state.board.robberHex) continue;
    const resource = hex.terrain as Resource;

    const corners: VertexId[] = [];
    for (const v of Object.values(state.board.vertices)) {
      if (v.hexes.includes(hex.id)) corners.push(v.id);
    }

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
  next = { ...next, bank: subtractResources(next.bank, bankOut), phase: 'main' };

  return next;
}

function emptyGrants(): Record<Resource, number> {
  return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
}
