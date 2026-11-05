import { useState } from 'react';
import type {
  Commodity,
  GameState,
  ImprovementTrack,
  PlayerId,
  ProgressCardKind,
  Resource,
  TradeGood,
} from '@/game/types';
import { COMMODITIES, IMPROVEMENT_TRACKS, RESOURCES } from '@/game/types';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ProgressCardFace } from '@/ui/shared/ProgressCardFace';
import { useCanAct } from '@/ui/shared/useCanAct';
import {
  PROGRESS_CARD_DESCRIPTION,
  PROGRESS_CARD_LABEL,
} from '@/game/modules/citiesAndKnights/progress/catalogue';
import {
  canSwapToken,
  irrigationMiningYield,
  progressCardBlocker,
} from '@/game/modules/citiesAndKnights/actions/playProgressCard';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { cityWallSites } from '@/game/modules/citiesAndKnights/actions/buildCityWall';
import { canPlaceFreeRoad } from '@/game/modules/citiesAndKnights/actions/buildWrappers';
import { canPromoteKnightAt, legalIntrigueTargets } from '@/game/modules/citiesAndKnights/knights/legal';
import { merchantSites } from '@/game/modules/citiesAndKnights/actions/placeMerchant';
import { openRoads } from '@/game/modules/citiesAndKnights/progress/diplomacy';
import { PROGRESS_CARD_HAND_LIMIT } from '@/game/modules/citiesAndKnights/constants';
import { MAX_CITIES } from '@/game/actions/build';
import { ALL_GOODS, GoodChoice, PlayerChoice, goodLabel, handSize, playerName, vpNote } from './common';

// The active player's progress cards (p.10, p.13-16): the hand by deck, the
// face-up VP cards, and for the picked card its text, whether it can be
// played now (and why not), and whatever it needs before playing — a
// target player, a resource, dice values, or picks on the board.
export function ProgressCardsDialog() {
  const { game, dialog, closeDialog } = useGameStore();
  const acting = game ? getActingPlayerId(game) : null;
  const canAct = useCanAct(game, acting);
  const [picked, setPicked] = useState<{ card: ProgressCardKind; deck: ImprovementTrack } | null>(null);
  if (!game || dialog !== 'progressCards' || !acting) return null;
  const player = game.players.find((p) => p.id === acting)!;
  const hand = player.progressCards ?? { science: [], trade: [], politics: [] };
  const total = hand.science.length + hand.trade.length + hand.politics.length;
  const sel =
    picked && hand[picked.deck].includes(picked.card) ? picked : null;

  return (
    <DialogShell
      title={`Progress cards (${total}/${PROGRESS_CARD_HAND_LIMIT})`}
      variant="docked"
      onClose={closeDialog}
    >
      <div className="ck-stack">
        {total === 0 && (player.progressVpCards?.length ?? 0) === 0 && (
          <p className="ck-soft">
            No progress cards yet. Build city improvements: when the event die shows a track's icon
            and the red die is within your level's range, you draw that deck's card.
          </p>
        )}
        {total > PROGRESS_CARD_HAND_LIMIT && (
          <p className="ck-blocker">
            Over the hand limit: play or discard down to {PROGRESS_CARD_HAND_LIMIT} by the end of your turn.
          </p>
        )}
        <div className="ck-cards">
          {IMPROVEMENT_TRACKS.flatMap((deck) =>
            hand[deck].map((card, i) => (
              <ProgressCardFace
                key={`${deck}-${card}-${i}`}
                card={card}
                deck={deck}
                onClick={() => setPicked({ card, deck })}
                title={PROGRESS_CARD_DESCRIPTION[card]}
              />
            )),
          )}
          {(player.progressVpCards ?? []).map((card, i) => (
            <ProgressCardFace
              key={`vp-${card}-${i}`}
              card={card}
              deck={card === 'printing' ? 'science' : 'politics'}
              vp
              title={PROGRESS_CARD_DESCRIPTION[card]}
            />
          ))}
        </div>
        {sel && (
          <CardDetail
            key={`${sel.deck}-${sel.card}`}
            game={game}
            acting={acting}
            card={sel.card}
            canAct={canAct}
            onClose={() => setPicked(null)}
          />
        )}
        {!sel && total > 0 && <p className="ck-soft">Pick a card to read it and play it.</p>}
      </div>
    </DialogShell>
  );
}

function CardDetail({
  game,
  acting,
  card,
  canAct,
  onClose,
}: {
  game: GameState;
  acting: PlayerId;
  card: ProgressCardKind;
  canAct: boolean;
  onClose: () => void;
}) {
  const { dispatch, closeDialog, openDialog, setMode } = useGameStore();
  const [target, setTarget] = useState<PlayerId | null>(null);
  const [good, setGood] = useState<TradeGood | null>(null);
  const blocker = canAct ? progressCardBlocker(game, acting, card) : 'Not your turn';
  const me = calculateVictoryPoints(game, acting, true);
  const others = game.playerOrder.filter((p) => p !== acting);
  const play = (extra: Record<string, unknown> = {}) => {
    dispatch({ type: 'playProgressCard', playerId: acting, card, ...extra } as never);
    closeDialog();
  };
  const board = (mode: Parameters<typeof setMode>[0]) => {
    setMode(mode);
    closeDialog();
  };

  let body: React.ReactNode = null;
  let action: React.ReactNode = null;
  const button = (label: string, onClick: () => void, disabled = false) => (
    <Button variant="primary" disabled={!!blocker || disabled} onClick={onClick}>
      {label}
    </Button>
  );

  switch (card) {
    case 'alchemy':
      action = button('Set the dice…', () => {
        closeDialog();
        openDialog('alchemy');
      });
      break;
    case 'crane':
      action = button('Play — next improvement 1 cheaper', () => {
        dispatch({ type: 'playProgressCard', playerId: acting, card });
        openDialog('cityImprovements');
      });
      break;
    case 'engineering': {
      const sites = cityWallSites(game, acting);
      body = sites.length === 0 && <p className="ck-soft">No city can take a wall now (max 3, one per city).</p>;
      action = sites.length > 0 ? button('Pick a city for the free wall', () => board({ kind: 'engineering' })) : button('Play anyway (no effect)', () => play());
      break;
    }
    case 'medicine': {
      const me2 = game.players.find((p) => p.id === acting)!;
      const ok = me2.settlements.length > 0 && me2.cities.length < MAX_CITIES;
      const afford = me2.resources.wheat >= 1 && me2.resources.ore >= 2;
      body = !afford && <p className="ck-blocker">You need 1 wheat and 2 ore.</p>;
      action = button('Pick a settlement to upgrade', () => board({ kind: 'medicine' }), !ok || !afford);
      break;
    }
    case 'invention': {
      const n = game.board.hexIds.filter((h) => canSwapToken(game, h)).length;
      action = button('Pick two discs on the board', () => board({ kind: 'swapTokens' }), n < 2);
      break;
    }
    case 'irrigation':
    case 'mining': {
      const yieldN = irrigationMiningYield(game, acting, card === 'irrigation' ? 'wheat' : 'ore');
      body = <p className="ck-soft">You would take {yieldN} {card === 'irrigation' ? 'wheat' : 'ore'}.</p>;
      action = button('Play', () => play());
      break;
    }
    case 'progressRoadBuilding': {
      const any = game.board.edgeIds.some((e) => canPlaceFreeRoad(game, acting, e));
      action = any
        ? button('Place 2 free roads', () => board({ kind: 'progressRoadBuilding' }))
        : button('Play (no road fits)', () => play({ edges: [] }));
      break;
    }
    case 'smithing': {
      const any = Object.entries(game.knights ?? {}).some(
        ([v, k]) => k.playerId === acting && canPromoteKnightAt(game, acting, v),
      );
      action = any
        ? button('Pick up to 2 knights', () => board({ kind: 'smithing', selected: [] }))
        : button('Play (no knight can be promoted)', () => play({ knightVertices: [] }));
      break;
    }
    case 'commercialHarborCard':
      action = button('Play — make offers', () => {
        dispatch({ type: 'playProgressCard', playerId: acting, card });
        openDialog('commercialHarbor');
      });
      break;
    case 'guildDues': {
      const richer = others.filter((p) => calculateVictoryPoints(game, p, true) > me);
      body = (
        <PlayerChoice game={game} players={richer} value={target} onChange={setTarget} note={(p) => `${vpNote(game)(p)} · ${handSize(game, p)} cards`} />
      );
      action = button('Look at their hand', () => play({ targetId: target }), !target);
      break;
    }
    case 'merchantCard':
      action = button(
        merchantSites(game, acting).length > 0 ? 'Place the merchant' : 'Play (no hex next to your buildings)',
        () => play(),
      );
      break;
    case 'merchantFleet':
      body = <GoodChoice goods={ALL_GOODS} value={good} onChange={setGood} />;
      action = button(
        good ? `2:1 ${goodLabel(good)} this turn` : 'Name a resource or commodity',
        () =>
          play(
            (RESOURCES as readonly string[]).includes(good!)
              ? { resource: good as Resource }
              : { commodity: good as Commodity },
          ),
        !good,
      );
      break;
    case 'resourceMonopoly':
      body = <GoodChoice goods={RESOURCES} value={good} onChange={setGood} />;
      action = button(good ? `Take up to 2 ${goodLabel(good)} from each player` : 'Name a resource', () => play({ resource: good }), !good);
      break;
    case 'tradeMonopoly':
      body = <GoodChoice goods={COMMODITIES} value={good} onChange={setGood} />;
      action = button(good ? `Take 1 ${goodLabel(good)} from each player` : 'Name a commodity', () => play({ commodity: good }), !good);
      break;
    case 'diplomacy':
      body = openRoads(game).length === 0 && <p className="ck-soft">No open road on the board: the card would do nothing.</p>;
      action = button('Play — pick an open road', () => play());
      break;
    case 'encouragement':
      action = button('Activate all my knights', () => play());
      break;
    case 'espionage':
      body = (
        <PlayerChoice
          game={game}
          players={others}
          value={target}
          onChange={setTarget}
          note={(p) => {
            const h = game.players.find((x) => x.id === p)!.progressCards;
            return `${h ? h.science.length + h.trade.length + h.politics.length : 0} cards`;
          }}
        />
      );
      action = button('Look at their cards', () => play({ targetId: target }), !target);
      break;
    case 'intrigue':
      action = button('Pick an opposing knight on your road', () => board({ kind: 'intrigue' }), legalIntrigueTargets(game, acting).length === 0);
      break;
    case 'sabotage': {
      const hit = others.filter((p) => calculateVictoryPoints(game, p, true) >= me && Math.floor(handSize(game, p) / 2) > 0);
      body = (
        <p className="ck-soft">
          {hit.length === 0
            ? 'Nobody with as many VPs as you has cards to discard.'
            : `Discards half: ${hit.map((p) => playerName(game, p)).join(', ')}.`}
        </p>
      );
      action = button('Play', () => play());
      break;
    }
    case 'taxation':
      action = button('Move the robber', () => play());
      break;
    case 'treason': {
      const withKnights = others.filter((p) => Object.values(game.knights ?? {}).some((k) => k.playerId === p));
      body = (
        <PlayerChoice
          game={game}
          players={withKnights}
          value={target}
          onChange={setTarget}
          note={(p) => `${Object.values(game.knights ?? {}).filter((k) => k.playerId === p).length} knights`}
        />
      );
      action = button('They remove a knight', () => play({ targetId: target }), !target);
      break;
    }
    case 'wedding': {
      const richer = others.filter((p) => calculateVictoryPoints(game, p, true) > me && handSize(game, p) > 0);
      body = (
        <p className="ck-soft">
          {richer.length === 0 ? 'Nobody with more VPs has cards to give.' : `Each gives you 2 cards: ${richer.map((p) => playerName(game, p)).join(', ')}.`}
        </p>
      );
      action = button('Play', () => play());
      break;
    }
    case 'printing':
    case 'constitution':
      break;
  }

  return (
    <div className="ck-stack">
      <div className="ck-section-title">{PROGRESS_CARD_LABEL[card]}</div>
      <p className="ck-cardtext">{PROGRESS_CARD_DESCRIPTION[card]}</p>
      {blocker && <p className="ck-blocker">{blocker}</p>}
      {!blocker && body}
      <div className="ck-actions">
        <Button variant="ghost" onClick={onClose}>
          Back
        </Button>
        {action}
      </div>
    </div>
  );
}
