/**
 * War of Art – Game logic engine (Phase 1)
 * Classic War with "Royale War" on tie: 3 face-down + 4th decides winner of pile
 */

import type { GameCard, GameState, DuelResult } from "./types";

const CARDS_STAKED_IN_WAR = 3;
const FOURTH_CARD_INDEX = 3;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Create initial game state from two decks (any size).
 * Decks are shuffled and used in full.
 */
export function createGameState(
  matchId: string,
  playerDeck: GameCard[],
  opponentDeck: GameCard[]
): GameState {
  const p = shuffle([...playerDeck]);
  const o = shuffle([...opponentDeck]);
  return {
    matchId,
    playerDeck: [],
    opponentDeck: [],
    playerHand: p,
    opponentHand: o,
    currentPile: [],
    inWar: false,
    warStakeCount: 0,
    duelHistory: [],
    status: "playing",
  };
}

/**
 * Play one "flip" (or resolve war). Returns updated state and duel result if any.
 */
export function playTurn(state: GameState): {
  state: GameState;
  duel: DuelResult | null;
} {
  const s = { ...state };
  s.duelHistory = [...s.duelHistory];
  s.currentPile = [...s.currentPile];

  const playerCard = s.playerHand.shift();
  const opponentCard = s.opponentHand.shift();

  if (!playerCard || !opponentCard) {
    if (s.playerHand.length === 0 && s.opponentHand.length === 0) {
      const pWon = s.duelHistory.filter((d) => d.winner === "player").length;
      const oWon = s.duelHistory.filter((d) => d.winner === "opponent").length;
      s.status = pWon >= oWon ? "player_wins" : "opponent_wins";
    }
    return { state: s, duel: null };
  }

  s.currentPile.push(playerCard, opponentCard);

  if (playerCard.power > opponentCard.power) {
    const duel: DuelResult = {
      playerCard,
      opponentCard,
      winner: "player",
      pileSize: s.currentPile.length,
    };
    s.duelHistory.push(duel);
    s.playerHand.push(...shuffle(s.currentPile));
    s.currentPile = [];
    s.inWar = false;
    s.warStakeCount = 0;
    return { state: s, duel };
  }

  if (opponentCard.power > playerCard.power) {
    const duel: DuelResult = {
      playerCard,
      opponentCard,
      winner: "opponent",
      pileSize: s.currentPile.length,
    };
    s.duelHistory.push(duel);
    s.opponentHand.push(...shuffle(s.currentPile));
    s.currentPile = [];
    s.inWar = false;
    s.warStakeCount = 0;
    return { state: s, duel };
  }

  // Tie → Royale War: 3 face-down, 4th decides
  s.inWar = true;
  s.warStakeCount = s.currentPile.length;

  let warCards = 0;
  while (warCards < CARDS_STAKED_IN_WAR + 1) {
    const p = s.playerHand.shift();
    const o = s.opponentHand.shift();
    if (!p || !o) break;
    s.currentPile.push(p, o);
    warCards++;
  }

  const pileLen = s.currentPile.length;
  const fourthPlayer = s.currentPile[pileLen - 2];
  const fourthOpponent = s.currentPile[pileLen - 1];

  if (fourthPlayer && fourthOpponent) {
    if (fourthPlayer.power > fourthOpponent.power) {
      const duel: DuelResult = {
        playerCard: fourthPlayer,
        opponentCard: fourthOpponent,
        winner: "player",
        pileSize: s.currentPile.length,
      };
      s.duelHistory.push(duel);
      s.playerHand.push(...shuffle(s.currentPile));
      s.currentPile = [];
      s.inWar = false;
      s.warStakeCount = 0;
      return { state: s, duel };
    }
    if (fourthOpponent.power > fourthPlayer.power) {
      const duel: DuelResult = {
        playerCard: fourthPlayer,
        opponentCard: fourthOpponent,
        winner: "opponent",
        pileSize: s.currentPile.length,
      };
      s.duelHistory.push(duel);
      s.opponentHand.push(...shuffle(s.currentPile));
      s.currentPile = [];
      s.inWar = false;
      s.warStakeCount = 0;
      return { state: s, duel };
    }
    // Tie again on 4th card: treat as opponent wins the pile (or could recurse)
    const duel: DuelResult = {
      playerCard: fourthPlayer,
      opponentCard: fourthOpponent,
      winner: "opponent",
      pileSize: s.currentPile.length,
    };
    s.duelHistory.push(duel);
    s.opponentHand.push(...shuffle(s.currentPile));
    s.currentPile = [];
    s.inWar = false;
    s.warStakeCount = 0;
    return { state: s, duel };
  }

  return { state: s, duel: null };
}

/**
 * Check if game is over (one side has no cards left in hand).
 */
export function isGameOver(state: GameState): boolean {
  if (state.status !== "playing") return true;
  return state.playerHand.length === 0 || state.opponentHand.length === 0;
}

/**
 * Validate card power server-side (anti-cheat). Power must be 2–10.
 */
export function validateCardPower(card: GameCard): boolean {
  return (
    Number.isInteger(card.power) &&
    card.power >= 2 &&
    card.power <= 10
  );
}
