import type { EpMission, GameState, PlayerId } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';
import {
  bonusTileHolder,
  isExplorersPirates,
  missionVp,
  trackPosition,
} from '@/game/modules/explorersPirates/state';
import {
  EP_BONUS_TILE_NAMES,
  EP_FISH_HAULS,
  EP_LAIR_CREWS,
  EP_MISSIONS,
  EP_MISSION_NAMES,
  EP_TRACK_VP,
} from '@/game/modules/explorersPirates/constants';
import {
  AbilityIcon,
  DieIcon,
  EP_ABILITY_LABEL,
  LairIcon,
  MissionIcon,
  PirateShipIcon,
  abilityText,
} from '@/ui/game/explorersPirates/EpArt';
import { epEventLine } from '@/store/explorersPiratesLog';
import './ExplorersPiratesTracker.css';

// Scenario tab for Explorers & Pirates: the three mission tracks (every
// player's marker, the VP printed on each space, the bonus tile holder),
// how much of the sea is explored, the pirate lairs, spice farms and fish
// shoals found so far, the fish supply, the pirate ship's owner and the
// latest events. Reads only public state (never what lies face down, nor
// an uncaptured lair's number).
export function ExplorersPiratesTracker({ game }: { game: GameState }) {
  if (!isExplorersPirates(game)) return null;
  const ep = game.explorersPirates;
  const byId = (pid: PlayerId) => game.players.find((p) => p.id === pid);
  const regionHexes = Object.keys(ep.regionOf).length;
  const explored = regionHexes - Object.keys(ep.hidden).length;
  const last = ep.lastEvents?.events
    .map((e) => epEventLine(game, e))
    .filter((l): l is NonNullable<typeof l> => l !== null);
  const pirateOwner = ep.pirate ? byId(ep.pirate.owner) : null;
  return (
    <>
      <div className="scenario-panel-note">
        Win: {game.settings.victoryPointsToWin} VP during your turn. Settlement 1, harbor settlement 2, plus your
        mission tracks and bonus tiles.
      </div>

      <div className="scenario-panel-block">
        <div className="scenario-panel-block-head">
          <span>Missions</span>
          <span className="scenario-panel-block-sum">
            {game.playerOrder.map((pid) => `${byId(pid)?.name ?? pid} ${missionVp(game, pid)}`).join(' · ')} VP
          </span>
        </div>
        {EP_MISSIONS.map((m) => (
          <MissionTrack key={m} game={game} mission={m} />
        ))}
      </div>

      <div className="scenario-panel-block">
        <div className="scenario-panel-block-head">
          <span>Exploration</span>
          <span className="scenario-panel-block-sum">
            {explored}/{regionHexes} hexes discovered
          </span>
        </div>
        <div className="scenario-panel-note">
          A ship whose end reaches a corner of a face-down hex turns it over and ends its move: land pays 1 matching
          card, anything else 2 gold.
        </div>
      </div>

      <div className="scenario-panel-block">
        <div className="scenario-panel-block-head">
          <span>Pirate lairs</span>
          <span className="scenario-panel-block-sum">
            {ep.lairs.filter((l) => l.captured).length}/{ep.lairs.length} captured · 6 in all
          </span>
        </div>
        {ep.lairs.length === 0 ? (
          <div className="scenario-panel-note">None found yet — they hide under gold fields.</div>
        ) : (
          <ul className="scenario-panel-chips">
            {ep.lairs.map((l) => {
              const pending = ep.pendingLairs.includes(l.hex);
              return (
                <li key={l.hex} className={`scenario-panel-chip${l.captured ? ' is-claimed' : ''}`}>
                  <LairIcon size={16} captured={l.captured} />
                  <span className="scenario-panel-chip-name">
                    {l.captured && !pending
                      ? `Gold field ${game.board.hexes[l.hex]?.numberToken ?? ''}`
                      : pending
                        ? 'Captured — resolves this turn'
                        : `Lair ${l.crews.length}/${EP_LAIR_CREWS}`}
                  </span>
                  <span className="scenario-panel-chip-type">
                    <Dots game={game} players={l.crews} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="scenario-panel-block">
        <div className="scenario-panel-block-head">
          <span>Spice farms</span>
          <span className="scenario-panel-block-sum">{ep.farms.length}/6 found</span>
        </div>
        {ep.farms.length === 0 ? (
          <div className="scenario-panel-note">None found yet.</div>
        ) : (
          <ul className="scenario-panel-chips">
            {ep.farms.map((f) => (
              <li key={f.hex} className="scenario-panel-chip" title={abilityText(f.ability, f.pirateNumber)}>
                <AbilityIcon ability={f.ability} pirateNumber={f.pirateNumber} size={18} />
                <span className="scenario-panel-chip-name">
                  {EP_ABILITY_LABEL[f.ability]}
                  {f.pirateNumber ? ` (${f.pirateNumber})` : ''}
                </span>
                <span className="scenario-panel-chip-type">
                  crews <Dots game={game} players={f.crews} /> · sacks left {f.sacks.length}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="scenario-panel-block">
        <div className="scenario-panel-block-head">
          <span>Fish</span>
          <span className="scenario-panel-block-sum">
            {ep.fishSupply}/{EP_FISH_HAULS} hauls in supply
          </span>
        </div>
        {ep.shoals.length === 0 ? (
          <div className="scenario-panel-note">No shoals found yet (parrot shoals 1-3, goose 4-6).</div>
        ) : (
          <div className="ep-tracker-shoals">
            {[...ep.shoals]
              .sort((a, b) => a.number - b.number)
              .map((s) => (
                <span key={s.hex} className={`ep-tracker-shoal${s.haul ? ' has-haul' : ''}`} title={s.haul ? 'A fish haul is waiting here' : 'No haul right now'}>
                  <DieIcon n={s.number} size={14} />
                  {s.haul ? '🐟' : ''}
                </span>
              ))}
          </div>
        )}
        <div className="scenario-panel-note">
          Once a Movement phase, roll a die: a haul appears on the explored shoal with that number. Load it (it fills a
          ship) and deliver it at the Council.
        </div>
      </div>

      <div className="scenario-panel-block">
        <div className="scenario-panel-block-head">
          <span>Pirate ship</span>
          <span className="scenario-panel-block-sum">{pirateOwner ? pirateOwner.name : 'not on the board'}</span>
        </div>
        <div className="scenario-panel-note" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {pirateOwner && <PirateShipIcon color={pirateOwner.color} size={20} />}
          <span>
            A 7 (after discards) or a successful chase puts your pirate ship on a sea hex: rob a ship owner there.
            Other ships pay its owner 1 gold to sail onto, off or along its hex.
          </span>
        </div>
      </div>

      {last && last.length > 0 && (
        <div className="scenario-panel-note" style={{ fontStyle: 'normal' }}>
          <strong>Latest:</strong>{' '}
          {last.map((l) => `${l.player ? `${byId(l.player)?.name ?? ''} ` : ''}${l.text}`).join(' · ')}
        </div>
      )}
    </>
  );
}

function Dots({ game, players }: { game: GameState; players: readonly PlayerId[] }) {
  if (players.length === 0) return <span>—</span>;
  return (
    <>
      {players.map((pid, i) => {
        const p = game.players.find((x) => x.id === pid);
        return (
          <span
            key={`${pid}${i}`}
            className="ep-tracker-dot"
            style={{ background: p ? playerColorVar(p.color) : '#888' }}
            title={p?.name}
          />
        );
      })}
    </>
  );
}

// One mission track: a start box and the scoring spaces (VP printed on
// each), the players' markers stacked where they stand — the first to
// arrive at the bottom (it keeps the bonus tile on a tie).
function MissionTrack({ game, mission }: { game: GameState; mission: EpMission }) {
  const ep = game.explorersPirates!;
  const vps = EP_TRACK_VP[mission];
  const holder = bonusTileHolder(game, mission);
  const holderName = holder ? game.players.find((p) => p.id === holder)?.name : null;
  const at = (space: number) =>
    game.playerOrder
      .filter((pid) => trackPosition(game, mission, pid) === space)
      .sort((a, b) => (ep.arrivals[mission][a] ?? 0) - (ep.arrivals[mission][b] ?? 0));
  return (
    <div className="ep-track" title={`${EP_MISSION_NAMES[mission]} — VP per space: ${vps.join(', ')}`}>
      <div className="ep-track-head">
        <span>
          <MissionIcon mission={mission} size={14} /> {EP_MISSION_NAMES[mission]}
        </span>
        <span className={holderName ? 'ep-track-tile is-held' : 'ep-track-tile'}>
          ★ {EP_BONUS_TILE_NAMES[mission]}: {holderName ?? '—'}
        </span>
      </div>
      <div className="ep-track-cells">
        {[0, ...vps.map((_, i) => i + 1)].map((space) => (
          <div key={space} className={`ep-track-cell${space === 0 ? ' is-start' : ''}`}>
            <span className="ep-track-vp">{space === 0 ? 'start' : `${vps[space - 1]}`}</span>
            <span className="ep-track-markers">
              {at(space).map((pid) => {
                const p = game.players.find((x) => x.id === pid)!;
                return <span key={pid} className="ep-tracker-dot" style={{ background: playerColorVar(p.color) }} title={p.name} />;
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
