import type { Topic } from '../topics';
import { CastleEdgeKeyDiagram } from './barbarianAttackDiagrams';
import { RiverTilesDiagram, FishingDiagram } from './diagrams';
import { CommodityHexDiagram, WagonBoardTable, WagonCostTable } from './tradersBarbariansDiagrams';

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
          travel, defence, and luck. This build ships five scenarios —{' '}
          <strong>Rivers of Catan</strong>, <strong>Fishing on Catan</strong>,{' '}
          <strong>Merchant Trains</strong>, <strong>Barbarian Attack</strong> and
          the big <strong>Traders &amp; Barbarians</strong> scenario — plus the
          Friendly Robber, Strongest Ports and Catan Event Cards variants, which
          work with any game.
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
  {
    id: 'traders-tb-scenario',
    title: 'Traders & Barbarians (scenario)',
    body: (
      <>
        <p>
          The barbarians were driven back, but the castle needs repairs. Haul
          goods between the <strong>quarry</strong>, the <strong>castle</strong>{' '}
          and the <strong>glassworks</strong>: every token you deliver is worth{' '}
          <strong>1 VP</strong> and pays gold. First to <strong>13 VP</strong> on
          their turn wins. 3-4 players.
        </p>
        <ul>
          <li>
            <strong>The board</strong>: the three commodity hexes sit on corner
            hexes of the island, frame side out. The other 16 hexes are dealt
            from 4 forests, 3 pastures, 3 fields, 3 hills and 3 mountains; the
            number discs minus the 2 and the 12 go on them as usual. The
            frame harbors are the expansion's usual nine.
          </li>
          <li>
            <strong>Commodity hexes</strong> produce nothing. Each has four
            interior paths from its inland corners to a centre plaza. You may
            build roads on the paths (not on the edges with the red “X”), but no
            settlement on the plaza.
          </li>
          <li>
            <strong>Goods</strong>: the quarry provides sand and marble and buys
            tools; the castle provides tools and sand and buys marble and glass;
            the glassworks provides glass and tools and buys sand. Each location
            has a face-down stack of 12 tokens; only the mix of what is left is
            known (drawn tokens are face up).
          </li>
          <li>
            <strong>No robber, no Longest Road, no base development cards.</strong>{' '}
            Largest Army is in play (the scenario's Knights count).
          </li>
          <li>
            <strong>Setup</strong>: everyone starts with 5 gold. Your second
            starting placement is a <strong>city</strong> (1 card per adjacent
            hex); your wagon starts on it. The corners of a commodity hex
            between two “X” edges take no starting settlement — no road could
            leave them.
          </li>
          <li>
            <strong>Dice</strong>: a 2 or a 12 is re-rolled (the app does it and
            logs it). A 7: nobody produces, players discard as usual, then the
            roller moves one of the three barbarians to an edge without a
            barbarian. On a road it robs that road's owner of 1 random card.
          </li>
          <li>
            <strong>Coins</strong>: 2 gold buy 1 resource of your choice (up to
            twice a turn); resources buy gold at your supply trade rate; gold
            may go into player trades. Coins aren't cards: not in your hand
            size, never stolen.
          </li>
          <li>Roads may be built on edges with barbarians.</li>
        </ul>
        <CommodityHexDiagram />
      </>
    ),
  },
  {
    id: 'traders-tb-wagons',
    title: 'Wagons: moving, delivering, driving off barbarians',
    body: (
      <>
        <p>
          <strong>End of Turn phase</strong>: after your Action phase (the 🛒
          Move wagon button), you may move your wagon from intersection to
          intersection. You get the movement points (MP) of your wagon board;
          you must afford a whole edge, may stop any time, and lose unused MP.
          Buildings and other wagons never block. Press <strong>Done</strong>{' '}
          to pass the turn.
        </p>
        <WagonCostTable />
        <ul>
          <li>
            <strong>Plazas</strong>: entering a commodity hex's plaza ends the
            move. If your token is one that location buys, you deliver it (kept
            face down: 1 VP) and take the gold of your wagon level. Then, if
            your wagon is empty, you draw the top token of that location's
            stack (face up). You carry one token at a time.
          </li>
          <li>
            <strong>Drive off a barbarian</strong> (upgraded wagons): when your
            wagon stands at either end of a barbarian's edge, roll one die. In
            your level's range, you move that barbarian to any edge without
            one (no robbing). Each barbarian once per turn; you keep moving
            either way.
          </li>
          <li>
            <strong>Upgrades</strong> (Action phase): pay the cost to move your
            wagon one column right. Level 5 is worth 1 VP.
          </li>
        </ul>
        <WagonBoardTable />
        <p>
          The rules say wheat adds +2 MP “once per turn”, the player aid “up to
          2× per turn”; this app allows it once per move, so twice only when a
          Swift Journey gives you a second move.
        </p>
      </>
    ),
  },
  {
    id: 'traders-tb-cards',
    title: 'Traders & Barbarians development cards',
    body: (
      <>
        <p>
          The scenario's own 25 cards at the usual price (1 sheep, 1 wheat, 1
          ore), with the normal rules: hidden, one played per turn, not the
          turn you buy it.
        </p>
        <ul>
          <li>
            <strong>Knight</strong> (16): move 1 barbarian to an edge without a
            barbarian; if it lands on a road, rob that road's owner of 1 random
            card. Play it before you roll, in your Action phase or while your
            wagon moves. Knights count for Largest Army.
          </li>
          <li>
            <strong>Road Building</strong> (3): 2 free roads.
          </li>
          <li>
            <strong>Swift Journey</strong> (3): during your End of Turn phase,
            end this wagon move and take another with full MP.
          </li>
          <li>
            <strong>Victory Point</strong> (3: Stonecutting, Glassmaking,
            Toolmaking): 1 VP each, revealed when it wins you the game (even
            the turn you buy it).
          </li>
        </ul>
      </>
    ),
  },
];
