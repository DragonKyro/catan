// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import type { GameState } from '@/game/types';
import { simulate } from '@/ai/traders/simSupport';
import { getActingPlayerId, isPairedPlayer2 } from '@/game/helpers';
import { useGameStore } from '@/store/gameStore';
import { BoardSVG } from '@/ui/game/BoardSVG';
import { WagonVoteDialog } from '@/ui/dialogs/WagonVoteDialog';
import { ScenarioPanel } from './ScenarioPanel';

// Traders & Barbarians 5-6: the board art, the Scenario tab and the voting
// dialog on real 6-player positions from all-AI games.

function humanActs(s: GameState): GameState {
  const id = getActingPlayerId(s);
  return { ...s, players: s.players.map((p) => (p.id === id ? { ...p, isAI: false } : p)) };
}

const mid: Record<string, GameState> = {};
let p2Vote: GameState | undefined;
beforeAll(() => {
  for (const id of ['riversOfCatan', 'fishingOnCatan', 'merchantTrains', 'barbarianAttack']) {
    simulate(5, 6, { expansions: ['traders'], tradersScenarioId: id }, 12000, (_b, _a, after) => {
      if (after.phase === 'main' && (after.players[0]!.settlements.length + after.players[0]!.cities.length) >= 3) {
        mid[id] ??= after;
      }
      if (id === 'merchantTrains' && after.phase === 'wagonVoting' && after.wagonVote?.stage === 'bid' && isPairedPlayer2(after)) {
        p2Vote ??= after;
      }
    });
  }
});

describe('T&B 5-6 board art', () => {
  it('draws both watering holes, both castles, eight fishing grounds and both lakes', () => {
    const mt = render(<BoardSVG game={mid.merchantTrains!} />);
    expect(mt.container.querySelectorAll('.watering-hole').length).toBe(2);
    mt.unmount();
    const ba = render(<BoardSVG game={mid.barbarianAttack!} />);
    expect(ba.container.querySelectorAll('.ba-castle').length).toBe(2);
    ba.unmount();
    const fish = render(<BoardSVG game={mid.fishingOnCatan!} />);
    expect(fish.container.querySelectorAll('.fishing-ground').length).toBe(8);
    expect(fish.container.querySelectorAll('.lake-art').length).toBe(2);
    fish.unmount();
    const rivers = render(<BoardSVG game={mid.riversOfCatan!} />);
    expect(rivers.container.querySelectorAll('.river').length).toBe(3);
    rivers.unmount();
  });
});

describe('T&B 5-6 Scenario tab', () => {
  for (const id of ['riversOfCatan', 'fishingOnCatan', 'merchantTrains', 'barbarianAttack']) {
    it(`${id}: lists all six players`, () => {
      const s = mid[id]!;
      useGameStore.setState({ game: s });
      const { container, unmount } = render(<ScenarioPanel />);
      const text = container.textContent ?? '';
      for (const p of s.players) expect(text).toContain(p.name);
      unmount();
    });
  }
});

describe('T&B 5-6 Merchant Trains vote', () => {
  it("shows all six bidders in Player 2's voting round, Player 2 as the active player", () => {
    const s = humanActs(p2Vote!);
    useGameStore.setState({ game: s });
    const { container, getByText, unmount } = render(<WagonVoteDialog />);
    expect(container.querySelectorAll('.wagonvote-pill').length).toBe(6);
    const acquirer = s.players.find((p) => p.id === s.wagonVote!.acquirerId)!;
    expect(getByText(new RegExp(`${acquirer.name} collected a wagon`))).toBeTruthy();
    unmount();
  });
});
