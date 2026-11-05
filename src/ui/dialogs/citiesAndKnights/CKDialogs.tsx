import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useCanAct } from '@/ui/shared/useCanAct';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import { ImprovementsDialog } from './ImprovementsDialog';
import { ProgressCardsDialog } from './ProgressCardsDialog';
import { KnightsDialog } from './KnightsDialog';
import {
  AqueductDialog,
  DefenderTieDrawDialog,
  EspionageDialog,
  GuildDuesDialog,
  HarborAnswerDialog,
  HarborOfferDialog,
  ProgressDiscardDialog,
  TreasonPlaceDialog,
  WeddingGiveDialog,
} from './PhaseDialogs';

// Every Cities & Knights prompt, docked over the board: the one-player
// sub-phases (answered on the deciding seat's device only — useCanAct) and
// the dialogs opened from the ActionBar. Renders nothing outside C&K.
export function CitiesKnightsDialogs() {
  const { game, dialog, closeDialog, handoffPending } = useGameStore();
  const decider = game ? getActingPlayerId(game) : null;
  const canAct = useCanAct(game, decider);
  if (!game || !decider || !game.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID)) {
    return null;
  }
  if (handoffPending) return null;
  const props = { game, pid: decider };

  if (canAct) {
    switch (game.phase) {
      case 'defenderTieDraw':
        return <DefenderTieDrawDialog {...props} />;
      case 'progressCardDiscard':
        return <ProgressDiscardDialog {...props} />;
      case 'aqueductPick':
        return <AqueductDialog {...props} />;
      case 'commercialHarborOffer':
        return game.pendingCommercialHarbor ? <HarborAnswerDialog {...props} /> : null;
      case 'weddingGive':
        return game.pendingWedding ? <WeddingGiveDialog {...props} /> : null;
      case 'chooseProgressCardPick':
        if (game.progressPickState?.kind === 'espionage') return <EspionageDialog {...props} />;
        if (game.progressPickState?.kind === 'guildDues') return <GuildDuesDialog {...props} />;
        return null;
      case 'treasonPlaceKnight':
        return game.pendingTreason ? <TreasonPlaceDialog {...props} /> : null;
      default:
        break;
    }
  }
  if (dialog === 'cityImprovements') return <ImprovementsDialog />;
  if (dialog === 'progressCards') return <ProgressCardsDialog />;
  if (!canAct) return null;
  if (dialog === 'knights' && game.phase === 'main') {
    return <KnightsDialog {...props} onClose={closeDialog} />;
  }
  if (dialog === 'commercialHarbor' && game.phase === 'main' && game.commercialHarbor) {
    return <HarborOfferDialog {...props} onClose={closeDialog} />;
  }
  return null;
}
