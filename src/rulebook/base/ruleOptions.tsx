import type { Topic } from '../topics';

// Two-player games (colonist.io's 1v1 rules) and the rule options that work
// with any game. The Friendly Robber's own topic lives with the T&B variants
// it comes from (traders-friendly-robber).

export const RULE_OPTION_TOPICS: Topic[] = [
  {
    id: 'two-players',
    title: 'Two players (1v1)',
    body: (
      <>
        <p>
          The base game on the standard board can be played by <strong>two players</strong>,
          following colonist.io&apos;s 1v1 rules. Everything else is the normal game, including
          trading with each other and with the bank.
        </p>
        <ul>
          <li>
            <strong>15 victory points</strong> to win (instead of 10).
          </li>
          <li>
            When a 7 is rolled, only players with <strong>10 or more</strong> resource cards
            discard half (rounded down), instead of 8 or more.
          </li>
          <li>
            The <strong>Friendly Robber</strong> protects a player with 2 or fewer visible
            points: the robber can&apos;t go next to them and they can&apos;t be robbed.
          </li>
          <li>
            <strong>Balanced dice</strong> keep the rolls close to how often each number should
            come up, and stop one player rolling all the 7s.
          </li>
        </ul>
        <p className="rb-muted">
          Pick 2 players on the New Game screen (or seat two in the online lobby). Friendly Robber
          and Balanced dice are on by default and can be turned off under Rule options; the VP
          target can be changed too. The AI opponent is a trained AI made for these 1v1 rules: it
          rarely offers trades, since in a 2-player game any trade helps your only rival.
        </p>
      </>
    ),
  },
  {
    id: 'balanced-dice',
    title: 'Balanced dice (rule option)',
    body: (
      <>
        <p>
          With balanced dice, the rolls so far <strong>bias the next roll</strong> so a game
          doesn&apos;t swing on a run of bad luck:
        </p>
        <ul>
          <li>
            A number that has come up <strong>more than its share</strong> becomes less likely,
            and one that&apos;s <strong>overdue</strong> becomes more likely. Over a game each
            number comes up close to how often two dice should give it.
          </li>
          <li>
            A 7 is less likely <strong>straight after a 7</strong> (and less again after two).
          </li>
          <li>
            A player who has rolled <strong>more than their share of 7s</strong> rolls fewer of
            them, and one who has rolled fewer rolls more.
          </li>
        </ul>
        <p>
          The rolls are still random: a 7 can still follow a 7, and any number can come up on any
          turn. It just evens out sooner than with real dice.
        </p>
        <p className="rb-muted">
          Tick it under Rule options on the New Game screen (or in the online lobby). It works
          with every game except the Catan Event Cards, which replace the dice; it&apos;s on by
          default with 2 players. The exact weights are this app&apos;s own: colonist.io
          doesn&apos;t publish theirs.
        </p>
      </>
    ),
  },
];
