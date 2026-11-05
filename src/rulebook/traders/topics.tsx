import type { Topic } from '../topics';
import { RiverTilesDiagram, FishingDiagram } from './diagrams';

// Traders & Barbarians expansion rulebook entries. This commit covers the
// Rivers of Catan scenario plus the Friendly Robber and Strongest Ports
// variants. Future commits add Fishing on Catan, Merchant Trains, Barbarian
// Attack, the Traders & Barbarians combo scenario, and the remaining
// variants.

export const TRADERS_TOPICS: Topic[] = [
  {
    id: 'traders-overview',
    title: 'Traders & Barbarians — overview',
    body: (
      <>
        <p>
          The Traders & Barbarians expansion is a collection of mini-scenarios
          and rule tweaks that each highlight a different facet of Catan: trade,
          travel, defence, and luck. This build ships <strong>Rivers of
          Catan</strong> plus two small variants — Friendly Robber and Strongest
          Ports — that work with any base game.
        </p>
        <p>
          More scenarios are on the way. The architecture for gold (coins),
          bridges, and bonus VP tiles lands first so the rest can build on top
          without rewriting state shape.
        </p>
      </>
    ),
  },
  {
    id: 'traders-rivers',
    title: 'Rivers of Catan',
    body: (
      <>
        <p>
          Two <strong>river tiles</strong> lie at fixed places, each running down from a mountain
          where the river rises to a <strong>swamp</strong> where it meets the sea: one is mountains →
          hills → pasture → swamp, the other mountains → hills → swamp. The other 12 hexes are
          random (the base set minus 2 hills, 2 pastures, 2 mountains and the desert).
        </p>
        <RiverTilesDiagram />
        <ul>
          <li>
            <strong>Numbers.</strong> The 2 disc is set aside; the other 17 go on the 17 non-swamp
            hexes as usual, then the 2 joins the 12 on its hex. That hex produces on a 2{' '}
            <em>and</em> on a 12 (the robber blocks both).
          </li>
          <li>
            <strong>Swamps</strong> produce nothing. The robber starts on a swamp.
          </li>
          <li>
            <strong>Bridge sites</strong> are every place a river crosses or meets an edge (seven in
            all, dotted on the board). Roads may never go there, not even in setup.
          </li>
          <li>
            <strong>Gold for building:</strong> 1 gold for each road on any edge of a river tile, 1
            for each settlement on any corner of a river tile (setup included), 3 for each bridge.
            Cities earn none.
          </li>
          <li>
            <strong>Win:</strong> 10 VP on your turn.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'traders-bridges',
    title: 'Bridges',
    body: (
      <>
        <p>
          A bridge costs <strong>2 brick + 1 lumber</strong>, is worth 0 VP and pays{' '}
          <strong>3 gold</strong>. You have 3. It goes on an empty bridge site and must join one of
          your roads, bridges or buildings; you may not build one past an opponent's settlement or
          city (the same rule as a road).
        </p>
        <ul>
          <li>Bridges count as roads for Longest Route, and roads may continue from them.</li>
          <li>The Road Building card can't place bridges.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'traders-coins',
    title: 'Coins & gold',
    body: (
      <>
        <p>Gold is a currency, not a resource card (Rivers of Catan; the 🪙 Coins button):</p>
        <ul>
          <li>
            <strong>Spend</strong> 2 gold to take 1 resource card of your choice from the supply, up
            to <strong>twice a turn</strong>.
          </li>
          <li>
            <strong>Buy</strong> 1 gold from the supply with resource cards at your bank rate: 4 of a
            kind, 3 with a 3:1 harbor, 2 of a harbor's resource with its 2:1 harbor.
          </li>
          <li>
            Gold doesn't count toward your hand on a 7, can't be stolen and isn't taken by Monopoly.
            Everyone's gold is public.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'traders-wealth-tiles',
    title: 'Wealthiest / Poor Catanian',
    body: (
      <>
        <ul>
          <li>
            <strong>Wealthiest Catanian</strong> (+1 VP): the one player with the most gold. On a
            tie for the most, nobody holds it.
          </li>
          <li>
            <strong>Poor Catanian</strong> (−2 VP): every player tied for the least gold, even when
            that is everyone, so each player starts the game holding one. As soon as you are not
            among the poorest you hand it back.
          </li>
        </ul>
        <p>
          The tiles move the moment anyone's gold changes. Spending gold can drop you into the Poor
          tile; buying a single coin can lift you out of it.
        </p>
      </>
    ),
  },
  {
    id: 'traders-friendly-robber',
    title: 'Friendly Robber (variant)',
    body: (
      <>
        <p>
          When the variant is active, you may <strong>not</strong> place the
          robber on a hex whose only adjacent buildings belong to players with
          {' '}<strong>2 or fewer visible victory points</strong>. The robber
          targets the rich, not the new.
        </p>
        <p>
          The desert remains a legal target — if no other hex qualifies, you
          must move the robber there.
        </p>
      </>
    ),
  },
  {
    id: 'traders-strongest-ports',
    title: 'Strongest Ports (variant)',
    body: (
      <>
        <p>
          The first player to hold <strong>3 victory points worth of
          port-buildings</strong> (1 per settlement-on-port, 2 per
          city-on-port) takes the <strong>Strongest Ports</strong> bonus tile,
          worth <strong>+2 VP</strong>. If anyone later exceeds that total,
          the tile moves to them. Ties leave it unclaimed.
        </p>
        <p>
          To balance the bonus, the game's victory-point target is increased
          by 1 (e.g. 10 → 11). Combine with any base or scenario game.
        </p>
      </>
    ),
  },
  {
    id: 'traders-fishing',
    title: 'Fishing on Catan',
    body: (
      <>
        <p>
          The desert is replaced by the <strong>lake</strong>, placed with six random hexes in the
          inner ring of seven; the other 12 hexes form the outer ring. All 18 number discs go on
          the land. Six <strong>fishing grounds</strong> (light-blue frame tiles, numbered 4, 5, 6,
          8, 9, 10 at random) fill the coastal notches.
        </p>
        <FishingDiagram />
        <ul>
          <li>
            <strong>Catching.</strong> When a fishing ground's number is rolled, a settlement on any
            of its 3 corners draws 1 fish token, a city 2. The lake produces on each of its printed
            numbers <strong>2, 3, 11, 12</strong> for every building on its corners. Players draw one
            token at a time, starting with the active player.
          </li>
          <li>
            <strong>Setup.</strong> A second starting settlement next to a fishing ground or the
            lake draws 1 fish token.
          </li>
          <li>
            <strong>Tokens.</strong> 11 one-fish, 10 two-fish, 8 three-fish and the old boot, drawn
            face down; the discards are reshuffled when the supply runs out. Fish are secret, aren't
            resources (no discard, no theft, no trading).
          </li>
          <li>
            <strong>Limit.</strong> At most 7 fish tokens (the boot doesn't count). If you hold 7
            and would catch more, you catch nothing more this roll, but may swap one token for a
            fresh draw.
          </li>
          <li>
            <strong>Robber.</strong> It starts beside the board and enters on the first 7 or Knight.
            It may sit on the lake (blocking all four numbers), never on a fishing ground.
          </li>
          <li>
            <strong>Win:</strong> 10 VP, or 11 VP while you hold the old boot.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'traders-fish-spending',
    title: 'Spending fish tokens',
    body: (
      <>
        <p>
          On your turn (🐟 Spend), pay for each action with its own tokens; fish on them beyond the
          cost are lost, so the game picks the tokens that waste least.
        </p>
        <ul>
          <li>
            <strong>2 fish</strong>: remove the robber from the board (it returns on the next 7 or
            Knight).
          </li>
          <li>
            <strong>3 fish</strong>: steal a random resource card from a player of your choice.
          </li>
          <li>
            <strong>4 fish</strong>: take a resource card of your choice from the supply.
          </li>
          <li>
            <strong>5 fish</strong>: build a road for free (normal placement; then pick the edge).
          </li>
          <li>
            <strong>7 fish</strong>: take the top development card for free.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'traders-old-boot',
    title: 'The old boot',
    body: (
      <>
        <p>
          Whoever draws the old boot reveals it at once and now needs{' '}
          <strong>1 more VP to win</strong>. On your turn you may give it to any player with at
          least as many VP as you; hidden Victory Point cards don't count.
        </p>
      </>
    ),
  },
  {
    id: 'traders-merchant-trains',
    title: 'Merchant Trains',
    body: (
      <>
        <p>
          The desert is replaced by a <strong>watering hole</strong> at the
          centre of the board — the origin of every trade wagon. Whenever
          you build at least one piece on your turn, you acquire a wagon
          token. At the end of your turn, all players bid wool and wheat
          to decide where it lands.
        </p>
        <ul>
          <li>
            <strong>Acquiring.</strong> Building any number of pieces
            (road, settlement, city, bridge) on your turn earns you exactly
            one wagon.
          </li>
          <li>
            <strong>Voting.</strong> Each player commits some wool and/or
            wheat to a single target edge — or passes. Cards spent are
            forfeit to the supply.
          </li>
          <li>
            <strong>Resolution.</strong> First, the unique location with
            the most votes wins. Otherwise, the unique player with the most
            votes picks the placement. Otherwise, the acquirer (active
            builder) picks — even if they bid nothing.
          </li>
        </ul>
        <p>
          Trains start at the watering hole and extend in chains. New
          wagons must connect either to the watering hole or to a train
          endpoint (a vertex with exactly one incident wagon). Merchant
          trains do not branch — once two trains meet at a vertex, it's
          locked.
        </p>
        <p className="rb-muted">
          Robber starts off the board and enters on the first 7 or Knight.
          The game ends when someone reaches <strong>12 VP</strong>.
        </p>
      </>
    ),
  },
  {
    id: 'traders-merchant-scoring',
    title: 'Merchant Trains scoring',
    body: (
      <>
        <p>
          Wagons are <strong>neutral</strong> — they have no owner. They
          score for whoever's road shares the edge:
        </p>
        <ul>
          <li>
            <strong>Longest Route.</strong> A wagon sharing an edge with
            your road counts as an extra road on that edge — so a 3-road
            chain with 2 wagons on it is worth 5 toward Longest Route.
          </li>
          <li>
            <strong>Building bonus.</strong> Every settlement or city sat
            between two wagons (vertex with ≥ 2 incident wagons) earns
            {' '}<strong>+1 VP</strong>. Settlements jump from 1 → 2 VP,
            cities from 2 → 3 VP.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'traders-barbarian-attack',
    title: 'Barbarian Attack',
    body: (
      <>
        <p>
          Three castles ring the island. Each one is the target of a
          barbarian group creeping in from the sea. Every turn the
          barbarians advance one hex; when they arrive at a castle,
          combat resolves automatically. First player to <strong>12 VP
          </strong> wins.
        </p>
        <ul>
          <li>
            <strong>Castle hexes</strong> are non-producing and immune to
            the robber. They sit in the outer sea ring; building can still
            happen on adjacent coastal vertices.
          </li>
          <li>
            <strong>Barbarian groups</strong> walk a 4-hex path from an
            outer sea hex inward. The first three turns the barbarian
            moves; the fourth turn it arrives and fights.
          </li>
          <li>
            <strong>Defender knights</strong> are hired on the six edges
            that bound each castle. Up to 6 per castle (the supply of 18
            divides evenly across the three castles).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'traders-hire-knight',
    title: 'Hiring knights',
    body: (
      <>
        <p>
          During your main phase, spend <strong>1 wheat + 1 ore</strong>
          {' '}to place a defender knight on a castle-bordering edge that
          is empty (no road, ship, bridge, or knight there). Any player
          may fill any open castle slot — defenders aren't tied to your
          own road network, so you can rush to defend a contested castle
          even without prior buildup there.
        </p>
        <p>
          The <strong>shared knight supply</strong> starts at 18 (6 per
          castle). Each hire draws one; combat losses refund their
          knights to the supply, so the bag refills naturally over time.
        </p>
      </>
    ),
  },
  {
    id: 'traders-castle-combat',
    title: 'Castle combat',
    body: (
      <>
        <p>
          When a barbarian reaches its castle (path position 3 of 3),
          combat happens immediately at end of turn:
        </p>
        <ul>
          <li>
            <strong>Defender strength</strong> = the total number of
            knights on the six edges around the castle, summed across
            all players.
          </li>
          <li>
            <strong>Barbarian strength</strong> = 4 (default for every
            castle).
          </li>
          <li>
            If defenders ≥ barbarians, the defense wins: each
            participating player earns <strong>+1 VP per knight</strong>
            {' '}they brought, and roughly half the defending knights
            die (rounded up).
          </li>
          <li>
            If defenders &lt; barbarians, the castle is overrun. All
            defending knights die. The defender with the fewest knights
            loses one settlement / city adjacent to the castle (cities
            downgrade to settlements). When no defenders are present,
            any player with a building on the castle's hex may lose it.
          </li>
          <li>
            The barbarian resets to position 0 and the cycle repeats.
          </li>
        </ul>
      </>
    ),
  },
];
