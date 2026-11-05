import type { Topic } from '../topics';
import type { ImprovementTrack } from '@/game/types';
import { IMPROVEMENT_TRACKS } from '@/game/types';
import {
  PROGRESS_CARD_DESCRIPTION,
  PROGRESS_CARD_LABEL,
  PROGRESS_DECK_DEFINITIONS,
} from '@/game/modules/citiesAndKnights/progress/catalogue';
import {
  IMPROVEMENT_NAMES,
  LEVEL3_ABILITY_TEXT,
  TRACK_LABEL,
} from '@/game/modules/citiesAndKnights/constants';
import { maxRedDieForLevel } from '@/game/modules/citiesAndKnights/progress/draw';

// Cities & Knights (2025 rulebook) — what this build plays, topic by topic.
// The card lists and improvement tables are generated from the engine's
// catalogue so the reference can't drift from the rules in play.

// Plain function (not a component) so the rulebook search sees the text.
function cardList(track: ImprovementTrack) {
  return (
    <ul>
      {PROGRESS_DECK_DEFINITIONS[track].map(({ kind, n }) => (
        <li key={kind}>
          <strong>{PROGRESS_CARD_LABEL[kind].replace(' (VP)', '')}</strong> (×{n}) —{' '}
          {PROGRESS_CARD_DESCRIPTION[kind]}
        </li>
      ))}
    </ul>
  );
}

export const CITIES_AND_KNIGHTS_TOPICS: Topic[] = [
  {
    id: 'ck-overview',
    title: 'Cities & Knights — overview',
    body: (
      <>
        <p>
          Your settlements grow into cities, your cities trade in commodities and build city
          improvements, and every so often the barbarians sail in and pillage the island unless
          enough knights stand ready. The first player with <strong>13 VP</strong> on their own
          turn wins.
        </p>
        <ul>
          <li>Development cards and the Largest Army tile are not used; progress cards replace them.</li>
          <li>
            <strong>Setup:</strong> round 1 places a settlement and a road; round 2 (in reverse
            order) places a <strong>city</strong> and a road. The city collects 1 resource per
            adjacent hex.
          </li>
          <li>
            <strong>Maps:</strong> the rulebook's fixed first-game board (pick "C&K first game" as
            the base map) or a random board. Gold Rush and Volcano aren't available with C&K.
          </li>
          <li>
            <strong>Longest Route</strong> works like Longest Road, but knights break other players'
            routes.
          </li>
          <li>
            <strong>5-6 players:</strong> the 5-6 board, 6 more of each commodity, and paired turns
            (Player 2 takes an Action phase after Player 1 but may not trade with other players).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'ck-turn',
    title: 'The turn: roll, produce, act',
    body: (
      <>
        <p>
          <strong>Roll Dice phase.</strong> Before rolling you may play <em>Alchemy</em>. Then roll
          the red and yellow production dice and the event die. The <strong>event die</strong>{' '}
          resolves first:
        </p>
        <ul>
          <li>
            A <strong>ship</strong> (3 faces) moves the barbarians one space; on the last space
            they attack.
          </li>
          <li>
            A <strong>city gate</strong> in science, trade or politics: everyone whose level on that
            track covers the red die draws that deck's top card, in turn order from the active
            player. Level 1 draws on a red 1-2, level 2 on 1-3, … level 5 on 1-6.
          </li>
        </ul>
        <p>
          <strong>Production phase.</strong> Hexes produce, or Resolve a 7. Cities produce:
          forest 1 wood + 1 paper, pasture 1 wool + 1 cloth, mountains 1 ore + 1 coin, fields 2
          wheat, hills 2 brick.
        </p>
        <p>
          <strong>Action phase.</strong> In any order: trade, build, recruit / promote / activate
          knights, take knight actions, play progress cards.
        </p>
      </>
    ),
  },
  {
    id: 'ck-seven',
    title: 'A 7 and the robber',
    body: (
      <>
        <p>
          On a 7 nothing produces. Everyone holding more than 7 cards (resources + commodities)
          returns half, rounded down; each city wall raises that limit by 2.
        </p>
        <p>
          The robber starts <strong>off the board</strong>, waiting beside the barbarian track. Until
          the first barbarian attack it doesn't move and nobody steals. The first attack puts it on
          the desert; from then on a 7 moves it and steals 1 random resource or commodity card.
        </p>
      </>
    ),
  },
  {
    id: 'ck-commodities',
    title: 'Commodities and trading',
    body: (
      <>
        <p>
          Paper (forest cities), cloth (pasture cities) and coin (mountain cities) pay for city
          improvements. They count toward your hand on a 7, can be stolen, and can be traded:
        </p>
        <ul>
          <li>With other players: any mix of resources and commodities.</li>
          <li>
            With the supply: 4:1, or 3:1 with a generic harbor, for any resource or commodity; a 2:1
            harbor only trades its own resource.
          </li>
          <li>
            <strong>Merchant Guild</strong> (trade level 3): commodities 2:1 for resources or
            commodities.
          </li>
          <li>
            <strong>The merchant</strong> (Merchant card): 1 VP, and its hex's resource 2:1.
          </li>
          <li>Progress cards can never be traded.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'ck-barbarians',
    title: 'The barbarians attack',
    body: (
      <>
        <p>
          The ship starts on the first space of the track and attacks when it reaches the eighth
          (7 ship rolls). Then:
        </p>
        <ul>
          <li>
            <strong>Barbarian strength</strong> = the number of cities on the board (a city with a
            metropolis counts once). <strong>Defense</strong> = the strength of all active knights
            (basic 1, strong 2, mighty 3).
          </li>
          <li>
            <strong>Defense ≥ barbarians:</strong> the player who contributed the most takes a{' '}
            <em>Defender of Catan</em> VP token. If several tie, each instead draws a progress card
            from the deck of their choice, starting with the active player.
          </li>
          <li>
            <strong>Barbarians stronger:</strong> the player(s) who contributed least — no active
            knight counts as least — each lose a city (it becomes a settlement and loses its wall;
            you choose which if you have several). Metropolises can't be pillaged; if the weakest
            can't lose a city, the next weakest do.
          </li>
          <li>
            The ship returns to the start and <strong>every knight is laid down</strong> (inactive).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'ck-city-walls',
    title: 'City walls',
    body: (
      <>
        <p>
          A wall (2 brick) goes under one of your cities, one per city, at most 3. Each wall lets
          you hold 2 more cards on a 7. A pillaged city loses its wall, which you may build again.
        </p>
      </>
    ),
  },
  {
    id: 'ck-knights',
    title: 'Knights',
    body: (
      <>
        <p>You have 2 basic, 2 strong and 2 mighty knights.</p>
        <ul>
          <li>
            <strong>Recruit</strong> (1 wool + 1 ore): a basic knight, lying down (inactive), on an
            empty intersection next to one of your roads. No distance rule.
          </li>
          <li>
            <strong>Activate</strong> (1 wheat): stand it up. A knight activated this turn can't act
            this turn.
          </li>
          <li>
            <strong>Promote</strong> (1 wool + 1 ore): the next stronger piece replaces it, same
            status. Each knight once per turn; strong → mighty needs politics level 3 (Fortress).
          </li>
          <li>
            Knights block other players' roads and settlement sites and break their Longest Route.
          </li>
        </ul>
        <p>
          <strong>Knight actions</strong> — by a knight active since the start of your turn, which
          then lies down:
        </p>
        <ul>
          <li>
            <strong>Move</strong> along your own roads, past your own pieces but not others', to an
            empty intersection.
          </li>
          <li>
            <strong>Displace</strong> a weaker opposing knight on your roads: you take its place and
            its owner moves it (status unchanged) — if it has nowhere to go, it returns to their
            supply.
          </li>
          <li>
            <strong>Chase away the robber</strong> from a corner of its hex: move the robber and
            steal as on a 7.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'ck-improvements',
    title: 'City improvements',
    body: (
      <>
        <p>
          You need at least one city. Each level costs as many of its track's commodity as the
          level number (science: paper, trade: cloth, politics: coin); no skipping levels. You keep
          your levels if you lose your last city, but can't build more until you have a city again.
        </p>
        <table className="rb-table">
          <thead>
            <tr>
              <th>Level</th>
              {IMPROVEMENT_TRACKS.map((t) => (
                <th key={t}>{TRACK_LABEL[t]}</th>
              ))}
              <th>Draws on red</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((lv) => (
              <tr key={lv}>
                <td>{lv}</td>
                {IMPROVEMENT_TRACKS.map((t) => (
                  <td key={t}>{IMPROVEMENT_NAMES[t][lv]}</td>
                ))}
                <td>1-{maxRedDieForLevel(lv)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Level 3 gives a permanent ability:</p>
        <ul>
          {IMPROVEMENT_TRACKS.map((t) => (
            <li key={t}>{LEVEL3_ABILITY_TEXT[t]}</li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: 'ck-metropolises',
    title: 'Metropolises',
    body: (
      <>
        <p>
          The first player to reach level 4 on a track takes its metropolis and puts it on one of
          their cities (temporary). The first to reach level 5 takes it for good — from whoever
          held it — and it can't be taken any more. A metropolis is worth 2 VP (4 with its city),
          one per city; if none of your cities is free, you may not buy the level that would win
          it. Metropolises can't be pillaged.
        </p>
      </>
    ),
  },
  {
    id: 'ck-progress-cards',
    title: 'Progress cards',
    body: (
      <>
        <ul>
          <li>Play any number in your Action phase — even the turn you draw them — except Alchemy (before rolling).</li>
          <li>
            <strong>Hand limit 4.</strong> A player over the limit when it isn't their turn
            discards at once; on your own turn you have until the end of the turn.
          </li>
          <li>
            Victory Point cards (Printing, Constitution) are placed face up at once: 1 VP each, never
            in your hand, safe from Espionage.
          </li>
          <li>Played and discarded cards go face down under their deck. A card with no effect still counts as played.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'ck-cards-science',
    title: 'Card reference — Science',
    body: cardList('science'),
  },
  {
    id: 'ck-cards-trade',
    title: 'Card reference — Trade',
    body: cardList('trade'),
  },
  {
    id: 'ck-cards-politics',
    title: 'Card reference — Politics',
    body: (
      <>
        {cardList('politics')}
        <p className="rb-muted">
          Diplomacy: a road is open if one of its ends touches none of its owner's roads or
          buildings and it doesn't link two of the owner's buildings or knights.
        </p>
      </>
    ),
  },
];
