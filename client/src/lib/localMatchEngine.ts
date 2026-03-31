/**
 * Local Match Engine — re-exports shared logic for the browser
 */

export type { GameCard, LocalMatch } from '@shared/matchEngine';
export {
  initializeLocalMatch,
  submitPick,
  getMatchStats,
  getWinnerInfo,
  getNftsCapturedFromOpponent,
} from '@shared/matchEngine';

import type { GameCard, LocalMatch } from '@shared/matchEngine';

export function drawCard(player: LocalMatch['player1'] | LocalMatch['player2']): GameCard | null {
  if (player.deck.length === 0) {
    return null;
  }
  const card = player.deck.pop();
  if (card) {
    player.hand.push(card);
  }
  return card || null;
}
