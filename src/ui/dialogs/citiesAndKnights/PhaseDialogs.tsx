import { useState } from 'react';
import type { GameState, ImprovementTrack, KnightStrength, PlayerId, Resource } from '@/game/types';
import { COMMODITIES, IMPROVEMENT_TRACKS, RESOURCES } from '@/game/types';
import { useGameStore } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';
import { ProgressCardBack, ProgressCardFace, TrackEmblem } from '@/ui/shared/ProgressCardFace';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import { CommodityChip } from '@/ui/shared/CommodityChip';
import {
  PROGRESS_CARD_DESCRIPTION,
} from '@/game/modules/citiesAndKnights/progress/catalogue';
import { KNIGHT_LABEL, TRACK_LABEL } from '@/game/modules/citiesAndKnights/constants';
import { treasonPlaceableStrengths, treasonPlacementSpots } from '@/game/modules/citiesAndKnights/knights/legal';
import { commercialHarborTargets } from '@/game/modules/citiesAndKnights/actions/commercialHarborOffer';
import { KnightGlyph } from '@/ui/game/citiesAndKnights/KnightPiece';
import { playerColorVar } from '@/ui/shared/playerColors';
import {
  EMPTY_SELECTION,
  GoodChoice,
  HandPicker,
  PlayerChoice,
  type Selection,
  Swatch,
  handSize,
  playerName,
  selectionCount,
} from './common';

interface Props {
  game: GameState;
  pid: PlayerId;
}

// Barbarians driven off with a tie at the top (p.11): pick a deck to draw.
export function DefenderTieDrawDialog({ game, pid }: Props) {
  const { dispatch } = useGameStore();
  const decks = game.progressDecks ?? { science: [], trade: [], politics: [] };
  const anyLeft = IMPROVEMENT_TRACKS.some((t) => decks[t].length > 0);
  return (
    <DialogShell title="The barbarians are driven off!" blocking>
      <p className="ck-soft" style={{ marginTop: 0 }}>
        {playerName(game, pid)}, you tied for the strongest defense, so instead of a VP token you
        draw a progress card from the deck of your choice.
      </p>
      <div className="ck-row">
        {IMPROVEMENT_TRACKS.map((t) => (
          <Button
            key={t}
            disabled={anyLeft && decks[t].length === 0}
            onClick={() => dispatch({ type: 'defenderTieDraw', playerId: pid, deck: t })}
          >
            <TrackEmblem track={t} /> {TRACK_LABEL[t]} ({decks[t].length})
          </Button>
        ))}
      </div>
    </DialogShell>
  );
}

// Over the 4-card hand limit (p.10): discard progress cards, one at a time.
export function ProgressDiscardDialog({ game, pid }: Props) {
  const { dispatch } = useGameStore();
  const player = game.players.find((p) => p.id === pid)!;
  const owed = game.progressCardDiscardRequired?.[pid] ?? 0;
  const hand = player.progressCards ?? { science: [], trade: [], politics: [] };
  const ending = game.endTurnAfterProgressDiscard && game.playerOrder[game.currentPlayerIndex] === pid;
  return (
    <DialogShell title={`Discard ${owed} progress card${owed === 1 ? '' : 's'}`} blocking>
      <p className="ck-soft" style={{ marginTop: 0 }}>
        {player.name} holds more than 4 progress cards
        {ending ? ' at the end of the turn' : ''}. Pick a card to put face down under its deck.
      </p>
      <div className="ck-cards">
        {IMPROVEMENT_TRACKS.flatMap((deck) =>
          hand[deck].map((card, i) => (
            <ProgressCardFace
              key={`${deck}-${card}-${i}`}
              card={card}
              deck={deck}
              title={`Discard ${card}: ${PROGRESS_CARD_DESCRIPTION[card]}`}
              onClick={() => dispatch({ type: 'discardProgressCard', playerId: pid, card, deck })}
            />
          )),
        )}
      </div>
    </DialogShell>
  );
}

// Aqueduct (science level 3): nothing produced → take a resource.
export function AqueductDialog({ game, pid }: Props) {
  const { dispatch } = useGameStore();
  return (
    <DialogShell title="Aqueduct" blocking>
      <p className="ck-soft" style={{ marginTop: 0 }}>
        {playerName(game, pid)} received nothing this roll. Take 1 resource of your choice.
      </p>
      <div className="ck-row">
        {RESOURCES.map((r) => (
          <button
            key={r}
            type="button"
            className="ck-good"
            disabled={game.bank[r] <= 0}
            onClick={() => dispatch({ type: 'aqueductPick', playerId: pid, resource: r })}
          >
            <ResourceChip resource={r} size="lg" />
          </button>
        ))}
      </div>
    </DialogShell>
  );
}

// Commercial Harbor (p.14), the offered player: hand over a commodity of
// your choice for the resource.
export function HarborAnswerDialog({ game, pid }: Props) {
  const { dispatch } = useGameStore();
  const ctx = game.pendingCommercialHarbor!;
  const me = game.players.find((p) => p.id === pid)!;
  return (
    <DialogShell title="Commercial Harbor" blocking>
      <p className="ck-soft" style={{ marginTop: 0 }}>
        {playerName(game, ctx.offererId)} offers you <ResourceChip resource={ctx.resource} size="sm" />. You
        must give 1 commodity of your choice in exchange.
      </p>
      <div className="ck-row">
        {COMMODITIES.filter((c) => (me.commodities?.[c] ?? 0) > 0).map((c) => (
          <button
            key={c}
            type="button"
            className="ck-good"
            onClick={() => dispatch({ type: 'commercialHarborOffer', playerId: pid, commodity: c })}
          >
            <CommodityChip commodity={c} count={me.commodities![c]} size="lg" />
          </button>
        ))}
      </div>
    </DialogShell>
  );
}

// Commercial Harbor (p.14), the card's player: make one offer per player.
export function HarborOfferDialog({ game, pid, onClose }: Props & { onClose: () => void }) {
  const { dispatch } = useGameStore();
  const [target, setTarget] = useState<PlayerId | null>(null);
  const [res, setRes] = useState<Resource | null>(null);
  const me = game.players.find((p) => p.id === pid)!;
  const targets = commercialHarborTargets(game);
  return (
    <DialogShell title="Commercial Harbor" onClose={onClose}>
      <div className="ck-stack">
        <p className="ck-soft" style={{ margin: 0 }}>
          Offer each other player one resource card; they must give you a commodity of their choice
          for it (a player without commodities keeps nothing and you keep your card). One offer per
          player, any time this turn.
        </p>
        {targets.length === 0 ? (
          <p className="ck-soft">You have made an offer to every player.</p>
        ) : (
          <>
            <PlayerChoice
              game={game}
              players={targets}
              value={target}
              onChange={setTarget}
              note={(p) => {
                const c = game.players.find((x) => x.id === p)!.commodities;
                const n = c ? c.paper + c.cloth + c.coin : 0;
                return n > 0 ? `${n} commodities` : 'no commodities';
              }}
            />
            <GoodChoice
              goods={RESOURCES}
              value={res}
              onChange={(g) => setRes(g as Resource)}
              disabled={(g) => me.resources[g as Resource] <= 0}
            />
          </>
        )}
        <div className="ck-actions">
          <Button variant="ghost" onClick={onClose}>
            Done for now
          </Button>
          {targets.length > 0 && (
            <Button
              variant="primary"
              disabled={!target || !res}
              onClick={() => {
                dispatch({ type: 'commercialHarborPropose', playerId: pid, targetId: target!, resource: res! });
                setTarget(null);
                setRes(null);
              }}
            >
              Offer
            </Button>
          )}
        </div>
      </div>
    </DialogShell>
  );
}

// Wedding (p.16): a player with more VPs gives 2 cards of their choice.
export function WeddingGiveDialog({ game, pid }: Props) {
  const { dispatch } = useGameStore();
  const [sel, setSel] = useState<Selection>(EMPTY_SELECTION);
  const me = game.players.find((p) => p.id === pid)!;
  const owed = Math.min(2, handSize(game, pid));
  const collector = game.pendingWedding!.collector;
  return (
    <DialogShell title="Wedding" blocking>
      <p className="ck-soft" style={{ marginTop: 0 }}>
        {playerName(game, collector)} played Wedding: give them {owed} card{owed === 1 ? '' : 's'} of your
        choice.
      </p>
      <HandPicker
        resources={me.resources}
        commodities={me.commodities ?? { paper: 0, cloth: 0, coin: 0 }}
        value={sel}
        onChange={setSel}
        max={owed}
      />
      <div className="ck-actions">
        <Button
          variant="primary"
          disabled={selectionCount(sel) !== owed}
          onClick={() => {
            dispatch({ type: 'weddingGive', playerId: pid, resources: sel.resources, commodities: sel.commodities });
            setSel(EMPTY_SELECTION);
          }}
        >
          Give {selectionCount(sel)}/{owed}
        </Button>
      </div>
    </DialogShell>
  );
}

// Espionage (p.15): look at the target's progress cards; take one or none.
export function EspionageDialog({ game, pid }: Props) {
  const { dispatch } = useGameStore();
  const targetId = game.progressPickState!.targetId;
  const hand = game.players.find((p) => p.id === targetId)!.progressCards ?? {
    science: [],
    trade: [],
    politics: [],
  };
  const count = hand.science.length + hand.trade.length + hand.politics.length;
  return (
    <DialogShell title={`Espionage — ${playerName(game, targetId)}'s cards`} blocking>
      <p className="ck-soft" style={{ marginTop: 0 }}>
        {count === 0 ? 'They hold no progress cards.' : 'You may take one card (VP cards are face up and safe).'}
      </p>
      <div className="ck-cards">
        {IMPROVEMENT_TRACKS.flatMap((deck: ImprovementTrack) =>
          hand[deck].map((card, i) => (
            <ProgressCardFace
              key={`${deck}-${card}-${i}`}
              card={card}
              deck={deck}
              title={`Take ${card}: ${PROGRESS_CARD_DESCRIPTION[card]}`}
              onClick={() => dispatch({ type: 'chooseProgressCardPick', playerId: pid, deck, card })}
            />
          )),
        )}
      </div>
      <div className="ck-actions">
        <Button onClick={() => dispatch({ type: 'chooseProgressCardPick', playerId: pid })}>
          Take nothing
        </Button>
      </div>
    </DialogShell>
  );
}

// Guild Dues (p.14): take any 2 cards from the target's (revealed) hand.
export function GuildDuesDialog({ game, pid }: Props) {
  const { dispatch } = useGameStore();
  const [sel, setSel] = useState<Selection>(EMPTY_SELECTION);
  const ctx = game.progressPickState!;
  const target = game.players.find((p) => p.id === ctx.targetId)!;
  const owed = Math.min(ctx.remaining, handSize(game, ctx.targetId));
  return (
    <DialogShell title={`Guild Dues — ${target.name}'s hand`} blocking>
      <p className="ck-soft" style={{ marginTop: 0 }}>
        Take any {owed} card{owed === 1 ? '' : 's'}.
      </p>
      <HandPicker
        resources={target.resources}
        commodities={target.commodities ?? { paper: 0, cloth: 0, coin: 0 }}
        value={sel}
        onChange={setSel}
        max={owed}
      />
      <div className="ck-actions">
        <Button
          variant="primary"
          disabled={selectionCount(sel) !== owed}
          onClick={() =>
            dispatch({
              type: 'chooseProgressCardPick',
              playerId: pid,
              resources: sel.resources,
              commodities: sel.commodities,
            })
          }
        >
          Take {selectionCount(sel)}/{owed}
        </Button>
      </div>
    </DialogShell>
  );
}

// Treason (p.16), the attacker: choose a strength to place (≤ the removed
// knight) then a spot on the board — or decline.
export function TreasonPlaceDialog({ game, pid }: Props) {
  const { dispatch, uiMode, setMode } = useGameStore();
  const t = game.pendingTreason!;
  const strengths = treasonPlaceableStrengths(game);
  const spots = treasonPlacementSpots(game, pid).length;
  const chosen = uiMode.kind === 'treasonPlaceKnight' ? uiMode.strength : undefined;
  const me = game.players.find((p) => p.id === pid)!;
  return (
    <DialogShell title="Treason — place a knight" blocking>
      <p className="ck-soft" style={{ marginTop: 0 }}>
        {playerName(game, t.targetId)} removed a {KNIGHT_LABEL[t.removedStrength!].toLowerCase()} (
        {t.removedActive ? 'active' : 'inactive'}). You may place one of your knights of that strength
        or lower on one of your roads ({spots} spots); it takes the same status.
      </p>
      <div className="ck-row">
        {strengths.map((s: KnightStrength) => (
          <button
            key={s}
            type="button"
            className={`ck-player${chosen === s ? ' is-selected' : ''}`}
            onClick={() => setMode({ kind: 'treasonPlaceKnight', strength: s })}
          >
            <svg width={26} height={26} viewBox="-13 -16 26 26" aria-hidden>
              <KnightGlyph color={playerColorVar(me.color)} strength={s} active={!!t.removedActive} />
            </svg>
            {KNIGHT_LABEL[s]}
          </button>
        ))}
      </div>
      <p className="ck-soft">{chosen ? 'Now click a highlighted intersection on the board.' : 'Pick a strength.'}</p>
      <div className="ck-actions">
        <Button onClick={() => dispatch({ type: 'treasonPlaceKnight', playerId: pid })}>Don't place one</Button>
      </div>
    </DialogShell>
  );
}

// Shown to everyone else while a choice is pending elsewhere (online).
export function WaitingNote({ game, pid, what }: Props & { what: string }) {
  return (
    <div className="ck-row ck-soft">
      <Swatch game={game} pid={pid} /> Waiting for {playerName(game, pid)} to {what}…
    </div>
  );
}

// A resource-or-commodity deck count line (used by the barbarian panel).
export function DeckBacks({ game }: { game: GameState }) {
  const decks = game.progressDecks ?? { science: [], trade: [], politics: [] };
  return (
    <div className="ck-row">
      {IMPROVEMENT_TRACKS.map((t) => (
        <ProgressCardBack key={t} deck={t} count={decks[t].length} />
      ))}
    </div>
  );
}
