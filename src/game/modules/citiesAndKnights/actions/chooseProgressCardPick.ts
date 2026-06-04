import type {
  ChooseProgressCardPickAction,
  GameState,
  ImprovementTrack,
  ProgressCardKind,
} from '../../../types';
import { RESOURCES, COMMODITIES } from '../../../types';
import { updatePlayer } from '../../../helpers';
import { VP_PROGRESS_CARDS } from '../progress/catalogue';

// Resolver for the two pick sub-phases:
//   - Espionage: picker takes 1 non-VP progress card from target's hand.
//   - Guild Dues: picker takes 2 cards (resources / commodities) from target.
export function handleChooseProgressCardPick(
  state: GameState,
  action: ChooseProgressCardPickAction,
): GameState {
  if (state.phase !== 'chooseProgressCardPick') {
    throw new Error(`Cannot pick in phase ${state.phase}`);
  }
  const ctx = state.progressPickState;
  if (!ctx) throw new Error('No pending pick state');
  if (action.playerId !== ctx.picker) throw new Error('Not your pick');

  if (ctx.kind === 'espionage') {
    if (!action.deck || !action.card) {
      throw new Error('Espionage pick needs deck + card');
    }
    if (VP_PROGRESS_CARDS.has(action.card)) {
      throw new Error('Cannot steal a VP card');
    }
    const target = state.players.find((p) => p.id === ctx.targetId);
    if (!target?.progressCards?.[action.deck].includes(action.card)) {
      throw new Error(`Target has no ${action.card} in ${action.deck}`);
    }
    // Move card from target to picker.
    let next = updatePlayer(state, ctx.targetId, (p) => ({
      ...p,
      progressCards: removeCard(p.progressCards, action.deck!, action.card!),
    }));
    next = updatePlayer(next, ctx.picker, (p) => ({
      ...p,
      progressCards: addCard(p.progressCards, action.deck!, action.card!),
    }));
    return {
      ...next,
      phase: 'main',
      progressPickState: undefined,
    };
  }

  // Guild Dues: collect resources/commodities totalling `remaining` cards.
  if (ctx.kind === 'guildDues') {
    let total = 0;
    for (const r of RESOURCES) total += action.resources?.[r] ?? 0;
    for (const c of COMMODITIES) total += action.commodities?.[c] ?? 0;
    if (total !== ctx.remaining) {
      throw new Error(`Must take exactly ${ctx.remaining} cards`);
    }
    const target = state.players.find((p) => p.id === ctx.targetId);
    if (!target) throw new Error('Unknown target');
    for (const r of RESOURCES) {
      const want = action.resources?.[r] ?? 0;
      if (want > target.resources[r]) {
        throw new Error(`Target doesn't have that many ${r}`);
      }
    }
    const tCom = target.commodities ?? { paper: 0, cloth: 0, coin: 0 };
    for (const c of COMMODITIES) {
      const want = action.commodities?.[c] ?? 0;
      if (want > tCom[c]) {
        throw new Error(`Target doesn't have that many ${c}`);
      }
    }
    // Transfer.
    let next = updatePlayer(state, ctx.targetId, (p) => ({
      ...p,
      resources: {
        wood: p.resources.wood - (action.resources?.wood ?? 0),
        brick: p.resources.brick - (action.resources?.brick ?? 0),
        sheep: p.resources.sheep - (action.resources?.sheep ?? 0),
        wheat: p.resources.wheat - (action.resources?.wheat ?? 0),
        ore: p.resources.ore - (action.resources?.ore ?? 0),
      },
      commodities: {
        paper:
          (p.commodities?.paper ?? 0) - (action.commodities?.paper ?? 0),
        cloth:
          (p.commodities?.cloth ?? 0) - (action.commodities?.cloth ?? 0),
        coin:
          (p.commodities?.coin ?? 0) - (action.commodities?.coin ?? 0),
      },
    }));
    next = updatePlayer(next, ctx.picker, (p) => ({
      ...p,
      resources: {
        wood: p.resources.wood + (action.resources?.wood ?? 0),
        brick: p.resources.brick + (action.resources?.brick ?? 0),
        sheep: p.resources.sheep + (action.resources?.sheep ?? 0),
        wheat: p.resources.wheat + (action.resources?.wheat ?? 0),
        ore: p.resources.ore + (action.resources?.ore ?? 0),
      },
      commodities: {
        paper:
          (p.commodities?.paper ?? 0) + (action.commodities?.paper ?? 0),
        cloth:
          (p.commodities?.cloth ?? 0) + (action.commodities?.cloth ?? 0),
        coin:
          (p.commodities?.coin ?? 0) + (action.commodities?.coin ?? 0),
      },
    }));
    return {
      ...next,
      phase: 'main',
      progressPickState: undefined,
    };
  }
  throw new Error(`Unknown pick kind: ${(ctx as { kind: string }).kind}`);
}

function removeCard(
  hand: { science: ProgressCardKind[]; trade: ProgressCardKind[]; politics: ProgressCardKind[] } | undefined,
  deck: ImprovementTrack,
  card: ProgressCardKind,
) {
  const cur = hand ?? { science: [], trade: [], politics: [] };
  const arr = cur[deck].slice();
  const idx = arr.indexOf(card);
  if (idx >= 0) arr.splice(idx, 1);
  return { ...cur, [deck]: arr };
}

function addCard(
  hand: { science: ProgressCardKind[]; trade: ProgressCardKind[]; politics: ProgressCardKind[] } | undefined,
  deck: ImprovementTrack,
  card: ProgressCardKind,
) {
  const cur = hand ?? { science: [], trade: [], politics: [] };
  return { ...cur, [deck]: [...cur[deck], card] };
}
