import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import { getBankTradeRate } from '../../../actions/trade';
import { calculateVictoryPoints } from '../../../scoring/points';

// The Forgotten Tribe scenario seeds `state.tribeTokens` with token defs
// anchored on outer-islet hexes. Each token is claimed the first time any
// player settles on a vertex adjacent to its hex.
describe('Forgotten Tribe: tribe tokens', () => {
  function fresh() {
    return createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 3,
      settings: { expansions: ['seafarers'], scenarioId: 'forgottenTribe' },
      randomizeTurnOrder: false,
    });
  }

  it('seeds tribe tokens with claimedBy=null', () => {
    const s = fresh();
    expect(s.tribeTokens).toBeDefined();
    expect(s.tribeTokens!.length).toBeGreaterThan(0);
    for (const t of s.tribeTokens!) expect(t.claimedBy).toBeNull();
  });

  it('claims a tribe token when a settlement is built adjacent', () => {
    let s = fresh();
    const token = s.tribeTokens!.find((t) => t.type === 'commercialHarbor')!;
    const cornerVid = s.board.vertexIds.find((vid) =>
      s.board.vertices[vid]!.hexes.includes(token.hexId),
    )!;

    // God-mode: drop a settlement at the corner and call the wrapped
    // handler directly via the engine reducer. We bypass setup phase so
    // the test is focused on the token-claim hook.
    s = { ...s, phase: 'main', hasRolledThisTurn: true };
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              resources: { wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 0 },
              // Pre-existing road so canPlaceSettlement passes.
              roads: [s.board.vertices[cornerVid]!.edges[0]!],
            }
          : p,
      ),
    };
    const before = s.players[0]!.commercialHarbors ?? 0;
    s = applyAction(s, { type: 'buildSettlement', playerId: 'p0', vertex: cornerVid });

    const claimed = s.tribeTokens!.find((t) => t.hexId === token.hexId)!;
    expect(claimed.claimedBy).toBe('p0');
    // Commercial harbor token bumps the player's harbor count.
    expect((s.players[0]!.commercialHarbors ?? 0)).toBe(before + 1);
    // And the bank trade rate floor for any resource drops to 2.
    expect(getBankTradeRate(s, 'p0', 'wheat')).toBe(2);
    expect(getBankTradeRate(s, 'p0', 'ore')).toBe(2);
  });

  it('VP-type tokens count toward the player\'s VP total', () => {
    let s = fresh();
    const token = s.tribeTokens!.find((t) => t.type === 'victoryPoint')!;
    const cornerVid = s.board.vertexIds.find((vid) =>
      s.board.vertices[vid]!.hexes.includes(token.hexId),
    )!;
    s = { ...s, phase: 'main', hasRolledThisTurn: true };
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              resources: { wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 0 },
              roads: [s.board.vertices[cornerVid]!.edges[0]!],
            }
          : p,
      ),
    };
    // Compute the gain from the VP token in isolation: total VP after
    // settling minus what we'd score WITHOUT the token. Subtracting two
    // VP-calc results before/after the action would also conflate the
    // island-chip bonus (since the tribe islet is also an outer island).
    const vpBefore = calculateVictoryPoints(s, 'p0', false);
    s = applyAction(s, { type: 'buildSettlement', playerId: 'p0', vertex: cornerVid });
    const vpAfter = calculateVictoryPoints(s, 'p0', false);
    const sWithoutToken = {
      ...s,
      tribeTokens: s.tribeTokens!.map((t) =>
        t.hexId === token.hexId ? { ...t, claimedBy: null } : t,
      ),
    };
    const vpWithoutToken = calculateVictoryPoints(sWithoutToken, 'p0', false);
    expect(vpAfter - vpWithoutToken).toBe(1);
    // Sanity: total gain is positive (settlement + maybe chip + VP token).
    expect(vpAfter - vpBefore).toBeGreaterThanOrEqual(2);
  });

  it('does not re-fire on a re-claim (claimed tokens stay claimed)', () => {
    let s = fresh();
    const token = s.tribeTokens!.find((t) => t.type === 'devCard')!;
    s = {
      ...s,
      tribeTokens: s.tribeTokens!.map((t) =>
        t === token ? { ...t, claimedBy: 'p1' } : t,
      ),
    };
    const cornerVid = s.board.vertexIds.find((vid) =>
      s.board.vertices[vid]!.hexes.includes(token.hexId),
    )!;
    s = { ...s, phase: 'main', hasRolledThisTurn: true };
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              resources: { wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 0 },
              roads: [s.board.vertices[cornerVid]!.edges[0]!],
            }
          : p,
      ),
    };
    const deckBefore = s.devCardDeck.length;
    s = applyAction(s, { type: 'buildSettlement', playerId: 'p0', vertex: cornerVid });
    // Already claimed: p0 doesn't gain a dev card, deck unchanged.
    expect(s.devCardDeck.length).toBe(deckBefore);
    const claimed = s.tribeTokens!.find((t) => t.hexId === token.hexId)!;
    expect(claimed.claimedBy).toBe('p1');
  });
});
