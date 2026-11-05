import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { runSetupPhase } from '../../../__testHelpers';
import { applyAction, getActiveModules, robberHexAllowed } from '../../../engine';
import { calculateVictoryPoints } from '../../../scoring/points';
import { supportsNeuralAi } from '@/ai/nn';
import type { GameState } from '../../../types';

// The T&B variants are rule modules that work with any rule set.
describe('T&B variants with other rule sets', () => {
  it('Strongest Ports in a base game: +1 VP target, and the tile moves on its own', () => {
    let s = runSetupPhase(
      createGame({
        playerNames: ['A', 'B', 'C'],
        seed: 4,
        settings: { tradersVariants: { strongestPorts: true } },
        randomizeTurnOrder: false,
      }),
    );
    expect(s.settings.expansions).toEqual([]);
    expect(s.settings.victoryPointsToWin).toBe(11);
    expect(s.strongestPorts).toEqual({ holder: null });
    // Hand p2 three harbor settlements (3 port VPs), then any action.
    const portVertices = s.board.ports.map((p) => s.board.edges[p.edge]!.vertices[0]);
    const vpBefore = calculateVictoryPoints(s, 'p2', false);
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p2' ? { ...p, settlements: [...p.settlements, ...portVertices.slice(0, 3)] } : p,
      ),
    };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [2, 2] });
    expect(s.strongestPorts).toEqual({ holder: 'p2' });
    expect(calculateVictoryPoints(s, 'p2', false)).toBe(vpBefore + 3 + 2);
  });

  it('Friendly Robber and Event Cards are kept on Seafarers games', () => {
    const s: GameState = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 4,
      settings: {
        expansions: ['seafarers'],
        scenarioId: 'headingForNewShores',
        tradersVariants: { friendlyRobber: true, eventCards: true },
      },
    });
    expect(s.settings.tradersVariants).toMatchObject({ friendlyRobber: true, eventCards: true });
    const ids = getActiveModules(s).map((m) => m.id);
    expect(ids.slice(0, 2)).toEqual(['tradersEventCards', 'tradersFriendlyRobber']);
    expect(ids).toContain('seafarers');
    const t = runSetupPhase(s);
    // Every hex with a (2-VP) starting building is off limits.
    const built = new Set(t.players.flatMap((p) => p.settlements));
    for (const h of t.board.hexIds) {
      if (t.board.hexes[h]!.corners.some((v) => built.has(v))) {
        expect(robberHexAllowed(t, h, 'p0')).toBe(false);
      }
    }
  });

  it('no variant module is active in a plain game, and any variant turns the trained AI off', () => {
    const plain = createGame({ playerNames: ['A', 'B', 'C'], seed: 1 });
    expect(plain.settings.tradersVariants).toBeUndefined();
    expect(getActiveModules(plain).map((m) => m.id)).toEqual(['base']);
    for (const v of ['friendlyRobber', 'strongestPorts', 'eventCards'] as const) {
      expect(supportsNeuralAi({ expansions: [], tradersVariants: { [v]: true } })).toBe(false);
    }
  });
});
