import type { Topic } from '../topics';

// Traders & Barbarians expansion rulebook entries: the scenarios and the
// variants (Friendly Robber, Strongest Ports, Catan Event Cards), which work
// with any game.

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
          You may <strong>not</strong> move the robber to a hex with a building of a player who
          has only <strong>2 VPs</strong> (or fewer) — even if richer players have buildings
          there too. Only visible VPs count; hidden Victory Point cards don&apos;t.
        </p>
        <p>
          If no hex is valid, the robber goes to the <strong>desert</strong>, and you may steal
          only from a player there with <strong>more than 2 VPs</strong>. (On a board with no
          desert it goes to a non-producing hex — a swamp or the watering hole.) The board only
          highlights legal hexes.
        </p>
        <p className="rb-muted">
          A variant: tick it under &quot;Traders &amp; Barbarians variants&quot; on the New Game
          screen. It works with the base game, Seafarers and every T&amp;B scenario.
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
          The first player to have <strong>3 VPs in buildings on harbors</strong> (a settlement
          counts 1, a city 2) takes the <strong>Strongest Ports</strong> tile, worth{' '}
          <strong>+2 VP</strong>. A player who gets <strong>more</strong> harbor VPs than the
          holder takes it over at once; a tie doesn&apos;t.
        </p>
        <p>
          The game needs <strong>1 VP more</strong> to win (10 → 11). Works with the base game,
          Seafarers, every T&amp;B scenario and Cities &amp; Knights.
        </p>
      </>
    ),
  },
  {
    id: 'traders-event-cards',
    title: 'Catan Event Cards (variant)',
    body: (
      <>
        <p>
          An event deck replaces the dice. At the start of your turn press{' '}
          <strong>Flip event card</strong>: resolve the card&apos;s event, then everyone collects
          resources — or you resolve a 7 — for the <strong>number on the card</strong>. The card
          shows where the dice would be.
        </p>
        <p>
          The deck is 36 numbered cards plus <strong>New Year</strong>, which sits 6th from the
          bottom: when it turns up the whole deck is reshuffled the same way and the next card
          flipped. The numbers follow the dice odds exactly (one 2, two 3s, … six 7s, … one 12),
          so production is steadier than with dice.
        </p>
        <p>
          Events that ask something of a player (take or give a card, steal, damage a road) open
          a prompt for each player in turn order, starting with you; production follows.
        </p>
        <p className="rb-muted">
          The rulebook doesn&apos;t print which number each card carries; this deck puts Robber
          Attacks on the six 7s and spreads the other events over the other numbers. Not yet
          combined with Cities &amp; Knights.
        </p>
      </>
    ),
  },
  {
    id: 'traders-event-card-list',
    title: 'Event card list',
    body: (
      <>
        <ul>
          <li><strong>A Beautiful Day</strong> — no event (16 cards).</li>
          <li><strong>Calm Seas</strong> — the player(s) with the most buildings on harbors take 1 resource of their choice.</li>
          <li><strong>Conflict</strong> — the Largest Army holder steals 1 random resource from any player; without one, the player with the most Knights played (if only one) may.</li>
          <li><strong>Earthquake</strong> — everyone damages one of their roads. You can&apos;t build roads until you repair all yours (1 brick + 1 wood each, the 🔧 button); nobody may build a settlement next to a damaged road. Damaged roads still count for the Longest Route.</li>
          <li><strong>Epidemic</strong> — cities collect only 1 resource this turn.</li>
          <li><strong>Good Neighbors</strong> — everyone gives 1 resource of their choice to the player on their left (all at once).</li>
          <li><strong>Helpful Neighbor</strong> — the player(s) with the most VPs give 1 resource to a player with fewer VPs.</li>
          <li><strong>New Year</strong> — rebuild the deck and flip again.</li>
          <li><strong>Plentiful Year</strong> — everyone takes 1 resource of their choice.</li>
          <li><strong>Robber Attacks</strong> — resolve a 7: discard, move the robber, steal.</li>
          <li><strong>Robber Flees</strong> — the robber goes back to the desert (off the board if there is none); no steal.</li>
          <li><strong>Tournament</strong> — the player(s) with the most Knights played take 1 resource of their choice.</li>
          <li><strong>Trade Advantage</strong> — the Longest Route holder steals 1 random resource from any player.</li>
        </ul>
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
          The desert is replaced by the <strong>watering hole</strong> in the centre; the other
          18 hexes and numbers are placed at random. The robber starts beside the board and comes
          in on the first 7 or Knight. <strong>12 VP</strong> wins.
        </p>
        <ul>
          <li>
            <strong>Collecting a wagon.</strong> Build at least one <em>building</em> — a
            settlement or a city — in your turn and you collect 1 wagon (never more than one a
            turn; roads and bridges don&apos;t count). It&apos;s placed in a voting round when you
            end your turn.
          </li>
          <li>
            <strong>Voting round.</strong> Starting with you and going clockwise, each player may
            lay any number of wool and/or wheat face up — 1 card, 1 vote; later bidders see the
            earlier bids. A player with <strong>more than half of all votes</strong> chooses
            where the wagon goes. Otherwise each bidder gives all their votes to one spot:
            <ol>
              <li>a spot with the most votes gets the wagon;</li>
              <li>otherwise the player with the most votes chooses;</li>
              <li>otherwise you (the active player) choose — even if you bid nothing.</li>
            </ol>
            All bids go to the supply. The possible spots are shown on the board as lettered
            ghost wagons. (With only one possible spot the wagon is placed without a vote.)
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'traders-merchant-train-placement',
    title: 'Placing wagons',
    body: (
      <>
        <ul>
          <li>
            Trains start at the watering hole&apos;s three <strong>start corners</strong> (green
            arrows: north-west, north-east, south — never the corners with a red cross). A new
            train&apos;s first wagon goes on the edge leading <em>away</em> from the hex.
          </li>
          <li>
            A wagon goes on an edge without a wagon (a road is fine). It either starts a new
            train or is added <strong>nose to tail at the front</strong> of a train — each
            wagon&apos;s cab shows which way its train runs. Trains never branch.
          </li>
          <li>
            When a train&apos;s front reaches an intersection already on another train they{' '}
            <strong>merge</strong>: meeting the other train&apos;s front, one train goes on from
            there; meeting any other part of it, the arriving train ends. A train also ends when
            its front can&apos;t go on, or when the 22-wagon supply runs out.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'traders-merchant-scoring',
    title: 'Merchant Trains scoring',
    body: (
      <>
        <p>Wagons are neutral pieces. They score for the pieces they touch:</p>
        <ul>
          <li>
            <strong>Longest Route.</strong> A wagon on the same edge as your road counts as one
            extra road — 3 roads with wagons on 2 of them make a route of 5.
          </li>
          <li>
            <strong>Buildings between 2 wagons</strong> (2 or more wagon edges meet at the
            intersection) are worth <strong>+1 VP</strong>: a settlement 2 VP, a city 3 VP.
          </li>
        </ul>
        <p className="rb-muted">
          The Scenario tab lists the trains, the wagon supply, the current bids and the last
          vote.
        </p>
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
