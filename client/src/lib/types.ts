/**
 * Shared types for DRiP Royale
 */

import type { GameCard as _GameCard } from '@shared/matchEngine';

export type GameCard = _GameCard;

/** DAS API asset (Helius getAssetsByOwner item) */
export interface DASAsset {
  id: string;
  content?: {
    json_uri?: string;
    files?: Array<{ uri?: string; cdn_uri?: string; mime?: string }>;
  };
  creators?: Array<{ address: string; verified?: boolean }>;
  grouping?: Array<{ group_key: string; group_value: string }>;
  ownership?: { owner: string };
  compression?: { compressed: boolean };
  [key: string]: unknown;
}

/** Deck = N DRiP cNFTs selected for battle (user chooses size) */
export type BattleDeck = GameCard[];

/** Single duel result (one flip) */
export interface DuelResult {
  playerCard: GameCard;
  opponentCard: GameCard;
  winner: "player" | "opponent" | "war";
  pileSize?: number; // when war, number of cards in pile
}

/** Full game state for one match */
export interface GameState {
  matchId: string;
  playerDeck: GameCard[];
  opponentDeck: GameCard[];
  playerHand: GameCard[];
  opponentHand: GameCard[];
  currentPile: GameCard[];
  inWar: boolean;
  warStakeCount: number;
  duelHistory: DuelResult[];
  status: "playing" | "player_wins" | "opponent_wins" | "settling";
}

/** Ledger entry (won/lost asset with Solscan link) */
export interface LedgerEntry {
  id: string;
  assetId: string;
  imageUri: string;
  name?: string;
  outcome: "won" | "lost";
  txSignature?: string;
  timestamp: string;
  solscanUrl: string;
}
