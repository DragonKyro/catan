// Merchant Trains voting round + Catan Event Cards log lines (combined with
// the Rivers / Fishing lines in tradersLog.ts).
import type { Action, GameState, PlayerId, ResourceBank, WagonPlacement } from '@/game/types';
import type { TradersLogLine } from './tradersLog';
import { RESOURCES } from '@/game/types';
import { EVENT_CARD_INFO } from '@/game/modules/traders/variants/eventCards/deck';
import {
  placementLabel,
  placementTags,
  placementKey,
} from '@/game/modules/traders/merchantTrains/trains';

// Log lines for the Traders & Barbarians Merchant Trains voting round and
// the Catan Event Cards variant, derived from the action plus a
// before/after diff (same shape as seafarersLog.ts, rendered as plain text
// entries).

function name(state: GameState, pid: PlayerId): string {
  return state.players.find((p) => p.id === pid)?.name ?? pid;
}

function gainedBy(before: GameState, after: GameState, pid: PlayerId): Partial<ResourceBank> {
  const b = before.players.find((p) => p.id === pid)!;
  const a = after.players.find((p) => p.id === pid)!;
  const out: Partial<ResourceBank> = {};
  for (const r of RESOURCES) {
    const d = a.resources[r] - b.resources[r];
    if (d > 0) out[r] = d;
  }
  return out;
}

function spotName(state: GameState, p: WagonPlacement): string {
  const tag = placementTags(state).find((t) => placementKey(t.placement) === placementKey(p))?.tag;
  return `${tag ? `spot ${tag}, ` : ''}${placementLabel(state, p)}`;
}

const DECIDED: Record<string, string> = {
  majority: 'majority of the votes',
  location: 'most votes for the spot',
  mostVotes: 'biggest bidder',
  activePlayer: 'tie — active player',
  noVotes: 'no bids — active player',
  onlyOption: 'the only free spot',
};

export function merchantTrainsAndEventLogLines(
  before: GameState,
  action: Action,
  after: GameState,
): TradersLogLine[] {
  const out: TradersLogLine[] = [];
  const me = action.playerId;

  // ----- Catan Event Cards -----
  if (after.eventCards) {
    if (action.type === 'rollDice' && after.eventCards.current) {
      const card = after.eventCards.current;
      const info = EVENT_CARD_INFO[card.kind];
      if (after.eventCards.newYear) {
        out.push({ player: me, text: '🎆 drew New Year: the event deck was rebuilt' });
      }
      out.push({ player: me, text: `flipped ${info.icon} ${info.name} — production on ${card.number}` });
      if (card.kind === 'robberFlees') {
        out.push({
          player: null,
          text: after.robberActive === false ? 'The robber fled off the board' : 'The robber fled to the desert',
        });
      }
    }
    const choice = before.eventCards?.pending?.choices[0];
    if (action.type === 'resolveEvent' && choice) {
      const card = before.eventCards!.pending!.card;
      const info = EVENT_CARD_INFO[card.kind];
      switch (choice.kind) {
        case 'takeResource':
          out.push({ player: me, text: `took a resource (${info.name})`, gained: gainedBy(before, after, me) });
          break;
        case 'giveResource': {
          const to = (choice.recipients?.length === 1 ? choice.recipients[0] : action.target) ?? null;
          out.push({ player: me, text: `gave a card to ${to ? name(after, to) : '?'} (${info.name})` });
          break;
        }
        case 'steal':
          out.push({
            player: me,
            text: action.target
              ? `stole a card from ${name(after, action.target)} (${info.name})`
              : `chose not to steal (${info.name})`,
          });
          break;
        case 'damageRoad':
          out.push({ player: me, text: 'had a road damaged by the Earthquake' });
          break;
      }
    }
    if (action.type === 'repairRoad') {
      out.push({ player: me, text: 'repaired a damaged road' });
    }
  }

  // ----- Merchant Trains -----
  if (after.wateringHoleHexId) {
    if (action.type === 'endTurn' && after.phase === 'wagonVoting' && before.phase === 'main') {
      out.push({ player: me, text: '🚂 collected a wagon — voting round: bid wool / wheat' });
    }
    if (action.type === 'submitWagonVote') {
      const sheep = action.cards.sheep ?? 0;
      const wheat = action.cards.wheat ?? 0;
      out.push(
        sheep + wheat === 0
          ? { player: me, text: 'passed in the wagon vote' }
          : {
              player: me,
              text: `bid ${sheep + wheat} vote${sheep + wheat === 1 ? '' : 's'} for the wagon (${[
                sheep ? `${sheep} wool` : '',
                wheat ? `${wheat} wheat` : '',
              ]
                .filter(Boolean)
                .join(' + ')})`,
            },
      );
      if (after.wagonVote?.stage === 'assign' && before.wagonVote?.stage === 'bid') {
        out.push({ player: null, text: 'No majority — bidders assign their votes to one spot each' });
      }
    }
    if (action.type === 'assignWagonVotes') {
      out.push({ player: me, text: `gave their votes to ${spotName(before, action.location)}` });
    }
    if (after.phase === 'placeWagon' && before.phase !== 'placeWagon' && after.pendingWagonPlacement) {
      const why = after.pendingWagonPlacement.reason ?? 'activePlayer';
      out.push({
        player: after.pendingWagonPlacement.placerId,
        text: `chooses where the wagon goes (${DECIDED[why]})`,
      });
    }
    const placed = (after.wagons?.length ?? 0) > (before.wagons?.length ?? 0);
    if (placed && after.lastWagonVote) {
      const v = after.lastWagonVote;
      out.push({
        player: v.chooser,
        text: `${v.chooser ? 'placed the wagon' : 'Wagon placed'}: ${placementLabel(before, v.placement)} (${DECIDED[v.decidedBy]}). ${after.wagonSupply} left`,
      });
      for (const t of after.merchantTrains ?? []) {
        const was = before.merchantTrains?.find((x) => x.id === t.id);
        if (t.ended && was && !was.ended) {
          out.push({
            player: null,
            text: t.mergedInto ? `Train ${t.id} merged into train ${t.mergedInto}` : `Train ${t.id} can't go further`,
          });
        }
      }
    }
  }
  return out;
}
