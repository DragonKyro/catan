import type {
  GameState,
  BuildSettlementAction,
  PlaceInitialSettlementAction,
  PlayerId,
} from '../../../types';
import { handleBuildSettlement as baseBuildSettlement } from '../../../actions/build';
import { handlePlaceInitialSettlement as basePlaceInitialSettlement } from '../../../actions/setup';
import { updatePlayer } from '../../../helpers';
import { validateStartingIsland } from '../validation/setupPlacement';

// After a settlement is placed, check whether it sits on an outer-island
// chip that hasn't been claimed yet. Award the chip to this player.
//
// A settlement vertex can be adjacent to multiple hexes from the same
// island; we award at most ONE chip per island per settlement. A vertex
// straddling two outer islands (very rare given how the board is built but
// possible at a sea-bridge corner) awards both unclaimed chips.
function claimIslandChips(state: GameState, playerId: string, vertexId: string): GameState {
  if (!state.islandChips || !state.board.islandOfHex) return state;
  const vertex = state.board.vertices[vertexId];
  if (!vertex) return state;

  const islandIds = new Set<string>();
  for (const hexId of vertex.hexes) {
    const islandId = state.board.islandOfHex[hexId];
    if (islandId) islandIds.add(islandId);
  }

  let changed = false;
  const newChips = state.islandChips.map((chip) => {
    if (chip.firstSettler === null && islandIds.has(chip.islandId)) {
      changed = true;
      return { ...chip, firstSettler: playerId };
    }
    return chip;
  });
  return changed ? { ...state, islandChips: newChips } : state;
}

export function handleBuildSettlementWithChips(
  state: GameState,
  action: BuildSettlementAction,
): GameState {
  let next = baseBuildSettlement(state, action);
  next = claimIslandChips(next, action.playerId, action.vertex);
  next = claimTribeTokens(next, action.playerId, action.vertex);
  return next;
}

// Forgotten Tribe: claim any unclaimed tribe token whose hex is adjacent
// to `vertexId`. A single settlement can claim multiple tokens if its
// vertex touches more than one tribe hex (uncommon but legal). Effects
// apply immediately at claim time:
//   - devCard: draw the top of the dev deck into boughtThisTurn (not
//     playable this turn, matching the bought-card rule)
//   - victoryPoint: handled by calculateVictoryPoints summing claimed VP
//     tokens — no player-field update needed at claim time
//   - commercialHarbor: increment player.commercialHarbors so bank trades
//     drop to 2:1 for any resource
function claimTribeTokens(
  state: GameState,
  playerId: PlayerId,
  vertexId: string,
): GameState {
  const tokens = state.tribeTokens;
  if (!tokens || tokens.length === 0) return state;
  const vertex = state.board.vertices[vertexId];
  if (!vertex) return state;
  const touchedHexes = new Set(vertex.hexes);

  let next = state;
  let deck = next.devCardDeck;
  const newTokens = tokens.map((token) => {
    if (token.claimedBy !== null) return token;
    if (!touchedHexes.has(token.hexId)) return token;
    if (token.type === 'devCard') {
      // Empty deck: still mark claimed (token is consumed), but skip the
      // grant. Matches the standard "no more cards to buy" rule.
      if (deck.length > 0) {
        const drawn = deck[0]!;
        deck = deck.slice(1);
        next = updatePlayer(next, playerId, (p) => ({
          ...p,
          devCards: {
            ...p.devCards,
            boughtThisTurn: [...p.devCards.boughtThisTurn, drawn],
          },
        }));
      }
    } else if (token.type === 'commercialHarbor') {
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        commercialHarbors: (p.commercialHarbors ?? 0) + 1,
      }));
    }
    // 'victoryPoint': no per-player field update — VP is summed from
    // `state.tribeTokens` at scoring time.
    return { ...token, claimedBy: playerId };
  });
  return { ...next, tribeTokens: newTokens, devCardDeck: deck };
}

// Count gold hexes adjacent to a vertex. Each one grants one "any resource"
// pick at the chooseGoldResource phase.
function goldPicksFor(state: GameState, vertexId: string): number {
  const vertex = state.board.vertices[vertexId];
  if (!vertex) return 0;
  let n = 0;
  for (const hexId of vertex.hexes) {
    if (state.board.hexes[hexId]?.terrain === 'gold') n++;
  }
  return n;
}

export function handlePlaceInitialSettlementWithChips(
  state: GameState,
  action: PlaceInitialSettlementAction,
): GameState {
  validateStartingIsland(state, action.vertex);
  const wasRound2 = state.phase === 'setupRound2';
  let next = basePlaceInitialSettlement(state, action);
  next = claimIslandChips(next, action.playerId, action.vertex);
  next = claimTribeTokens(next, action.playerId, action.vertex);

  // Round-2 only: a settlement adjacent to gold grants one free pick per gold
  // hex (rulebook: "If you place your second settlement adjacent to a Gold
  // hex you receive one resource of your choice"). Route through the same
  // chooseGoldResource phase used by gold-roll production, with a returnTo
  // marker so the handler knows to drop the player back into setup road
  // placement when picks resolve.
  if (wasRound2) {
    const picks = goldPicksFor(state, action.vertex);
    if (picks > 0) {
      next = {
        ...next,
        phase: 'chooseGoldResource',
        goldChoiceState: {
          pending: { [action.playerId]: picks },
          returnTo: 'setupRound2',
        },
      };
    }
  }
  return next;
}
