import type { Resource, ResourceBank } from './types';
import { RESOURCES } from './types';

export function emptyBank(): ResourceBank {
  return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
}

export function bankFull(amount: number): ResourceBank {
  return { wood: amount, brick: amount, sheep: amount, wheat: amount, ore: amount };
}

export function totalResources(bank: ResourceBank): number {
  return bank.wood + bank.brick + bank.sheep + bank.wheat + bank.ore;
}

export function canAfford(bank: ResourceBank, cost: Partial<ResourceBank>): boolean {
  for (const r of RESOURCES) {
    if ((cost[r] ?? 0) > bank[r]) return false;
  }
  return true;
}

export function addResources(bank: ResourceBank, delta: Partial<ResourceBank>): ResourceBank {
  return {
    wood: bank.wood + (delta.wood ?? 0),
    brick: bank.brick + (delta.brick ?? 0),
    sheep: bank.sheep + (delta.sheep ?? 0),
    wheat: bank.wheat + (delta.wheat ?? 0),
    ore: bank.ore + (delta.ore ?? 0),
  };
}

export function subtractResources(bank: ResourceBank, delta: Partial<ResourceBank>): ResourceBank {
  return {
    wood: bank.wood - (delta.wood ?? 0),
    brick: bank.brick - (delta.brick ?? 0),
    sheep: bank.sheep - (delta.sheep ?? 0),
    wheat: bank.wheat - (delta.wheat ?? 0),
    ore: bank.ore - (delta.ore ?? 0),
  };
}

export function flattenBank(bank: ResourceBank): Resource[] {
  const out: Resource[] = [];
  for (const r of RESOURCES) {
    for (let i = 0; i < bank[r]; i++) out.push(r);
  }
  return out;
}
