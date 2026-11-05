import type { Topic } from '../topics';
import { CastleEdgeKeyDiagram } from './barbarianAttackDiagrams';

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
          Two rivers cut through the island. To reach the far side of each
          river you must build <strong>bridges</strong> on the marked river
          edges. Every river-build pays in <strong>gold</strong>, and the
          player with the most gold at any moment wears the
          {' '}<strong>Wealthiest Catanian</strong> tile.
        </p>
        <ul>
          <li>
            <strong>Swamp hexes</strong> are non-producing. The robber starts
            on one of them; it can move between swamps and other hexes
            normally.
          </li>
          <li>
            <strong>River edges</strong> are reserved for bridges — roads
            cannot be built on them, and the Road Building dev card cannot
            place bridges.
          </li>
          <li>
            <strong>Building rewards.</strong> Each road or settlement built
            on a river tile (i.e. touching a swamp) earns
            {' '}<strong>1 gold</strong>. Each bridge earns
            {' '}<strong>3 gold</strong>.
          </li>
        </ul>
        <p>
          Bridges count as roads for Longest Road. They occupy the river edge
          and block opponents from building one of their own.
        </p>
      </>
    ),
  },
  {
    id: 'traders-bridges',
    title: 'Bridges',
    body: (
      <>
        <p>
          A bridge spans a river edge (a "bridge site"). It costs the same as
          a road — <strong>1 wood + 1 brick</strong> — and connects to your
          network exactly like a road or ship:
        </p>
        <ul>
          <li>Adjacent to one of your settlements or cities, OR</li>
          <li>Connected to one of your roads or bridges at a vertex, OR</li>
          <li>
            On a vertex not blocked by an opponent's settlement / city.
          </li>
        </ul>
        <p>
          You start with 3 bridges in your supply. Bridges count toward Longest
          Road. The <em>Road Building</em> dev card may not be used to place
          bridges (rulebook).
        </p>
      </>
    ),
  },
  {
    id: 'traders-coins',
    title: 'Coins & gold',
    body: (
      <>
        <p>
          Gold is a separate currency from the resource hand:
        </p>
        <ul>
          <li>
            <strong>Earned by</strong> building on a river tile (1 gold per
            road/settlement) or a bridge (3 gold).
          </li>
          <li>
            <strong>Spendable</strong> 2-for-1 to take any resource from the
            bank, up to 2 times per turn.
          </li>
          <li>
            <strong>Safe</strong> from the robber and the 7-roll discard
            threshold — gold doesn't count as a resource card.
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
        <p>
          Two VP tiles change hands as gold totals shift:
        </p>
        <ul>
          <li>
            <strong>Wealthiest Catanian</strong> (+1 VP). Held by the unique
            player with the most gold (≥ 1 gold). On a tie, no-one holds it.
          </li>
          <li>
            <strong>Poor Catanian</strong> (-2 VP). Held by every player tied
            at the lowest gold count, as long as someone else is ahead.
            Multiple players can be Poor at once.
          </li>
        </ul>
        <p>
          Both tiles recalculate every time anyone's gold total changes, so
          building a single bridge can flip the leaderboard.
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
          A <strong>lake</strong> replaces the desert at the centre of the
          board, and six <strong>fishing grounds</strong> sit on the frame at
          coastal vertices. Both produce fish tokens when their number is
          rolled. Fish are not resources — they're a separate currency you
          spend for special actions.
        </p>
        <ul>
          <li>
            <strong>Production.</strong> When the lake's number rolls,
            settlements and cities <em>adjacent</em> to the lake catch fish
            (1 per settlement, 2 per city). When a fishing ground's number
            rolls, only the building <em>at the anchor vertex</em> catches.
          </li>
          <li>
            <strong>Drawing.</strong> Tokens come from a face-down bag of
            29 fish (11×1, 10×2, 8×3) plus 1 old boot. The active player
            draws first, then clockwise. Draw order matters when the boot is
            still in the bag.
          </li>
          <li>
            <strong>Cap.</strong> You may not hold more than 7 fish tokens
            (the boot doesn't count). Excess draws are forfeit.
          </li>
          <li>
            <strong>Robber.</strong> The robber starts off-board and enters
            on the first 7 or Knight. You may place it on the lake to block
            lake production. You cannot place it on a fishing ground.
          </li>
        </ul>
        <p className="rb-muted">
          The setup round 2 settlement adjacent to the lake or a fishing
          ground draws 1 starting fish token (in addition to the usual
          resources).
        </p>
      </>
    ),
  },
  {
    id: 'traders-fish-spending',
    title: 'Spending fish tokens',
    body: (
      <>
        <p>
          Discard fish tokens summing to at least the cost to take the
          action. Excess fish on spent tokens is lost.
        </p>
        <ul>
          <li><strong>2 fish</strong> — Drive off the robber (returns next 7 / Knight).</li>
          <li><strong>3 fish</strong> — Steal 1 random resource from any player.</li>
          <li><strong>4 fish</strong> — Take 1 resource of your choice from the supply.</li>
          <li><strong>5 fish</strong> — Build a free road.</li>
          <li><strong>7 fish</strong> — Build a free development card.</li>
        </ul>
        <p className="rb-muted">
          Fish never count toward the 7-card discard threshold, can't be
          stolen, and can't be traded. (UI for the higher-tier spends —
          steal, free road, free dev card — lands in a follow-up.)
        </p>
      </>
    ),
  },
  {
    id: 'traders-old-boot',
    title: 'The old boot',
    body: (
      <>
        <p>
          The old boot is one of the 30 tokens in the fishing bag. The
          player who draws it keeps it face-up — they now need
          {' '}<strong>+1 VP</strong> to win (so 11 VP on the standard 10-VP
          game).
        </p>
        <p>
          On your turn you may pass the boot to any other player whose
          {' '}<strong>visible VPs ≥ yours</strong>. Hidden Victory Point
          dev cards don't count in that comparison.
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
          Barbarian raiders land on Catan's coast every time someone builds.
          Raise knights, drive them off and take them prisoner — every{' '}
          <strong>2 prisoners are worth 1 VP</strong>. First to{' '}
          <strong>12 VP</strong> on their turn wins.
        </p>
        <ul>
          <li>
            <strong>The board</strong>: the number discs are printed in fixed
            places. The castle (bottom left) and the desert (top right) sit on
            the coast; the other coastal hexes are dealt from 2 hills, 2
            forests, 3 pastures, 2 fields and 1 mountains, the 7 inner hexes
            from 1 hills, 1 forest, 1 pasture, 2 fields and 2 mountains. The
            coastal numbers are 2-6 and 8-12 once each.
          </li>
          <li>
            One barbarian starts on the 2 and one on the 12; 34 more wait next
            to the board (36 in all).
          </li>
          <li>
            <strong>No robber, no base development cards, no Largest
            Army.</strong> On a 7, players discard as normal, then the roller
            steals 1 random resource card from a player of their choice.
          </li>
          <li>
            <strong>Setup</strong>: your second starting placement is a{' '}
            <strong>city</strong>. It pays 1 card for each adjacent hex.
          </li>
          <li>
            <strong>Coins</strong>: gold comes from Treason, from losing
            knights and as consolation in prisoner draws. 2 gold buy 1 resource
            (up to twice a turn); resources buy gold at your supply trade rate.
            Coins aren't cards: not in your hand size, never stolen.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'traders-barbarian-landing',
    title: 'Barbarians land and conquer',
    body: (
      <>
        <p>
          <strong>Each time you place a settlement or city</strong> (not
          during setup) the barbarians attack. The app rolls the dice for
          you, until the result isn't 7; one barbarian lands on the coastal
          hex with that number unless it already holds 3. It rolls twice
          more, each time until the number differs from the earlier ones. It
          stops early when the barbarian supply is empty. The log shows every
          roll.
        </p>
        <ul>
          <li>
            <strong>3 barbarians conquer a hex</strong>: its number disc turns
            face down, it produces nothing, no more barbarians land there, and
            nobody may build on its edges or corners (cities included).
          </li>
          <li>
            <strong>A building touching only conquered hexes and the
            frame is conquered</strong> (drawn tipped over): it's worth no VP
            and its harbor can't be used. A building that also touches an
            inner hex, the desert or the castle (while unconquered) is safe.
          </li>
          <li>
            Taking barbarians off a conquered hex (Capture, Treason, or a
            victory) liberates it and stands its buildings up again.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'traders-barbarian-cards',
    title: 'Barbarian Attack development cards',
    body: (
      <>
        <p>
          The scenario has its own 26-card deck at the usual price (1 sheep, 1
          wheat, 1 ore). A card is <strong>played as soon as you buy
          it</strong>; buy as many as you like. Played cards are reshuffled
          when the deck runs out.
        </p>
        <ul>
          <li>
            <strong>Capture</strong> (4): take 1 barbarian from a coastal hex
            of your choice as a prisoner. With no barbarian on the coast the
            card is discarded and you draw another.
          </li>
          <li>
            <strong>Knighthood</strong> (14): place one of your knights on a
            free castle edge.
          </li>
          <li>
            <strong>Swift Knight</strong> (4): place one of your knights on
            any edge without a knight.
          </li>
          <li>
            <strong>Treason</strong> (4): take 2 gold, then move 2 barbarians
            from 2 different coastal hexes to 2 other unconquered coastal
            hexes (the desert and the castle count as coastal). When the
            coast holds too few barbarians, the rest come from the supply. A
            third barbarian moved onto a hex conquers it.
          </li>
        </ul>
        <p>
          A knight card with all 6 of your knights on the board (or, for
          Knighthood, no free castle edge) is discarded without effect.
        </p>
      </>
    ),
  },
  {
    id: 'traders-barbarian-knights',
    title: 'Knights and expelling the barbarians',
    body: (
      <>
        <p>
          <strong>End of your turn</strong>: when you press End turn with
          knights on the board you get a knight step. Pick a knight, then an
          edge up to <strong>3 edges</strong> away — or 4-5 edges for{' '}
          <strong>1 wheat</strong> (that knight only). Knights ignore every
          piece on the way but must stop on an edge without a knight, and
          never on a castle edge. A knight on a castle edge must move. Each
          knight moves once. Then press <strong>Done</strong>.
        </p>
        <p>
          <strong>Expel</strong>: starting with the 4 next to the castle and
          going clockwise, every coastal hex with at least 1 barbarian and{' '}
          <strong>more knights on its 6 edges than barbarians</strong> is a
          victory:
        </p>
        <ul>
          <li>
            The barbarians become prisoners of the players with knights there.
            One player alone takes them all. Otherwise each takes 1; a
            leftover goes to whoever has the most knights there (a tie is
            rolled for — the loser takes 3 gold). When there are fewer
            prisoners than players, everyone rolls and the prisoners go out
            from the highest roll; each player left without one takes 3 gold.
          </li>
          <li>A conquered hex is liberated.</li>
          <li>
            <strong>Knight losses</strong>: roll a die. 1 or 6 = the purple
            edges, 2 or 5 = green, 3 or 4 = brown (the castle tile's key).
            Each knight on the hex's edges of that direction returns to its
            owner, who takes 3 gold for it.
          </li>
        </ul>
        <CastleEdgeKeyDiagram />
      </>
    ),
  },
];
