import type { ReactNode } from 'react';
import {
  CostsDiagram,
  DistanceRuleDiagram,
  HexProductionDiagram,
  PiecesDiagram,
  PortDiagram,
  RobberDiagram,
} from './diagrams';
import { SEAFARERS_TOPICS } from './seafarers/topics';
import { FUN_MAPS_TOPICS } from './base/funMaps';

export interface Topic {
  id: string;
  title: string;
  body: ReactNode;
  // Optional grouping label rendered before this topic in the TOC. Used
  // to separate base-game topics from expansion sections.
  section?: string;
}

export const TOPICS: Topic[] = [
  {
    id: 'overview',
    title: 'Overview',
    body: (
      <>
        <p>
          Catan is a game of trade and expansion played on a randomized board
          of hexagonal terrain tiles surrounded by ocean.
        </p>
        <p>
          Each player tries to be the first to reach <strong>10 victory points</strong>{' '}
          by building settlements and cities, holding the longest road and
          largest army, and uncovering hidden victory-point cards.
        </p>
        <h4>The pieces</h4>
        <PiecesDiagram />
        <p className="rb-muted">
          You start with 5 settlements, 4 cities, and 15 roads in your supply.
        </p>
      </>
    ),
  },

  {
    id: 'setup',
    title: 'Setup',
    body: (
      <>
        <p>
          Setup is the only time players place pieces without paying for them.
          The board, number tokens, and turn order are randomized at the start
          of each game.
        </p>
        <ol>
          <li>
            <strong>Round 1.</strong> In turn order, each player places{' '}
            <em>one settlement</em> and <em>one road</em> touching it.
          </li>
          <li>
            <strong>Round 2.</strong> In reverse order, each player places a
            second settlement and a second road. The second settlement earns
            one resource card for each adjacent non-desert hex.
          </li>
        </ol>
        <p>
          Settlements must always obey the distance rule: no two settlements or
          cities may share an edge.
        </p>
        <DistanceRuleDiagram />
      </>
    ),
  },

  {
    id: 'turn',
    title: 'Taking a turn',
    body: (
      <>
        <p>A turn always proceeds in three steps:</p>
        <ol>
          <li>
            <strong>Optional knight.</strong> Before rolling, you may play one
            knight development card.
          </li>
          <li>
            <strong>Roll the dice.</strong> Two six-sided dice. Their sum
            triggers resource production unless it's a 7 (see Robber).
          </li>
          <li>
            <strong>Trade and build.</strong> Trade with the bank, the ports,
            or other players, then build with whatever resources you have.
          </li>
        </ol>
        <p>
          You may play at most <em>one</em> development card per turn (besides
          victory-point cards, which are revealed at game end).
        </p>
      </>
    ),
  },

  {
    id: 'production',
    title: 'Resource production',
    body: (
      <>
        <p>
          When the dice roll a number, every hex with that token produces. Each
          settlement on a producing hex earns <strong>1</strong> resource of
          that hex's type; each city earns <strong>2</strong>.
        </p>
        <HexProductionDiagram />
        <p>
          If the bank doesn't have enough of a resource to cover everyone's
          production, <em>nobody</em> gets that resource on this roll.
        </p>
        <p className="rb-muted">
          Number tokens: <strong>6</strong> and <strong>8</strong> have the most
          dots (the highest chance of being rolled). <strong>2</strong> and{' '}
          <strong>12</strong> have one dot — the least.
        </p>
      </>
    ),
  },

  {
    id: 'building',
    title: 'Building',
    body: (
      <>
        <p>
          On your turn you may spend resources to build. Settlements and roads
          must connect to your existing network: a settlement needs an adjacent
          road of yours, and a road must touch one of your roads, settlements,
          or cities.
        </p>
        <CostsDiagram />
        <p>
          Cities upgrade existing settlements — the settlement returns to your
          supply and a city replaces it on the same vertex. Cities produce two
          of their hex resource on each roll instead of one.
        </p>
      </>
    ),
  },

  {
    id: 'trading',
    title: 'Trading',
    body: (
      <>
        <p>
          On your turn you may trade as many times as you like, in any of three
          ways:
        </p>
        <ul>
          <li>
            <strong>Bank trade.</strong> Give 4 of any one resource to the
            bank, take 1 of any other.
          </li>
          <li>
            <strong>Port trade.</strong> A settlement or city on a port lets
            you trade through it. Generic ports take 3:1; specific ports take
            2:1 of that single resource.
          </li>
          <li>
            <strong>Player trade.</strong> Propose any combination of resources
            to anyone at the table. Any opponent with the asked-for cards may
            accept, counter, or reject.
          </li>
        </ul>
        <PortDiagram />
      </>
    ),
  },

  {
    id: 'devcards',
    title: 'Development cards',
    body: (
      <>
        <p>
          You may buy one development card per turn (1 wheat, 1 sheep, 1 ore)
          but may not play it on the same turn it was bought. There are five
          kinds:
        </p>
        <ul>
          <li>
            <strong>Knight.</strong> Move the robber and steal as you would on
            a 7. Knights count toward the <em>Largest Army</em> bonus.
          </li>
          <li>
            <strong>Road Building.</strong> Place two free roads.
          </li>
          <li>
            <strong>Year of Plenty.</strong> Take any two resources from the
            bank.
          </li>
          <li>
            <strong>Monopoly.</strong> Name a resource — every other player
            hands all of their cards of that type to you.
          </li>
          <li>
            <strong>Victory Point.</strong> Hidden until the game ends; counts
            as 1 VP toward the win threshold.
          </li>
        </ul>
        <p className="rb-muted">
          You may play at most one non-VP development card per turn.
        </p>
      </>
    ),
  },

  {
    id: 'robber',
    title: 'The robber',
    body: (
      <>
        <p>
          When anyone rolls a <strong>7</strong>, two things happen before the
          turn continues:
        </p>
        <ol>
          <li>
            Every player holding <strong>more than 7</strong> resource cards
            must discard half (rounded down).
          </li>
          <li>
            The current player moves the robber to any hex except its current
            location, then steals one random resource from a player with a
            settlement or city on that hex.
          </li>
        </ol>
        <RobberDiagram />
        <p>
          A hex with the robber on it does <em>not</em> produce, even when its
          number is rolled. The robber stays put until someone moves it.
        </p>
      </>
    ),
  },

  {
    id: 'bonuses',
    title: 'Longest Road & Largest Army',
    body: (
      <>
        <p>
          Two ongoing bonuses are worth <strong>2 victory points</strong> each:
        </p>
        <ul>
          <li>
            <strong>Longest Road.</strong> Awarded once any player has a
            continuous chain of at least <em>five</em> roads. If another
            player's chain exceeds the current holder's length, the bonus
            transfers. A chain interrupted by an opponent's settlement breaks
            at that point.
          </li>
          <li>
            <strong>Largest Army.</strong> Awarded once any player has played
            at least <em>three</em> knight cards. Transfers when another
            player plays more.
          </li>
        </ul>
      </>
    ),
  },

  {
    id: 'winning',
    title: 'Winning the game',
    body: (
      <>
        <p>
          The first player to reach <strong>10 victory points</strong> on their
          own turn wins immediately. Victory points come from:
        </p>
        <ul>
          <li>Settlements: 1 VP each (up to 5)</li>
          <li>Cities: 2 VP each (up to 4)</li>
          <li>Longest Road: 2 VP (transferable)</li>
          <li>Largest Army: 2 VP (transferable)</li>
          <li>Hidden Victory Point dev cards: 1 VP each</li>
        </ul>
        <p>
          VP from hidden dev cards is private until the moment of winning, so
          a player who appears to be at 8 VP can suddenly reveal cards for the
          finishing blow.
        </p>
      </>
    ),
  },
  // Base-game Fun Maps — colonist.io-style variants. Their own section so
  // players can find Volcano's eruption rule without scrolling.
  ...FUN_MAPS_TOPICS.map((t, i) => (i === 0 ? { ...t, section: 'Fun Maps' } : t)),
  // Seafarers expansion topics — rendered with a section header so they're
  // visually separated from the base-game topics.
  ...SEAFARERS_TOPICS.map((t, i) => (i === 0 ? { ...t, section: 'Seafarers' } : t)),
];
