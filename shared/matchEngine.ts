/**
 * Shared match logic (client + Node WS server)
 */

export interface GameCard {
  assetId: string;
  imageUri: string;
  name?: string;
  power: number;
  atRisk?: boolean;
}

export interface LocalMatch {
  id: string;
  player1: {
    name: string;
    deck: GameCard[];
    hand: GameCard[];
    won: GameCard[];
    pile: GameCard[];
  };
  player2: {
    name: string;
    deck: GameCard[];
    hand: GameCard[];
    won: GameCard[];
    pile: GameCard[];
  };
  currentRound: number;
  maxRounds: number;
  isActive: boolean;
  winner: "player1" | "player2" | null;
  pickTurn: "player1" | "player2" | null;
  roundLeader: "player1" | "player2";
  picksThisRound: {
    player1: GameCard | null;
    player2: GameCard | null;
  };
  roundResults: Array<{
    round: number;
    player1Card: GameCard;
    player2Card: GameCard;
    winner: "player1" | "player2" | "tie";
    player1Power: number;
    player2Power: number;
  }>;
}

export function initializeLocalMatch(
  player1Deck: GameCard[],
  player2Deck: GameCard[],
  player1Name: string = "Player 1",
  player2Name: string = "Player 2"
): LocalMatch {
  return {
    id: `match-${Date.now()}`,
    player1: {
      name: player1Name,
      deck: [...player1Deck].sort(() => Math.random() - 0.5),
      hand: [],
      won: [],
      pile: [],
    },
    player2: {
      name: player2Name,
      deck: [...player2Deck].sort(() => Math.random() - 0.5),
      hand: [],
      won: [],
      pile: [],
    },
    currentRound: 0,
    maxRounds: Math.min(player1Deck.length, player2Deck.length),
    isActive: true,
    winner: null,
    pickTurn: "player1",
    roundLeader: "player1",
    picksThisRound: { player1: null, player2: null },
    roundResults: [],
  };
}

export function submitPick(match: LocalMatch, player: "player1" | "player2", assetId: string): LocalMatch {
  if (!match.isActive || match.pickTurn !== player || match.picksThisRound[player]) {
    return match;
  }

  const pl = match[player];
  const idx = pl.deck.findIndex((c) => c.assetId === assetId);
  if (idx < 0) return match;

  const card = pl.deck[idx];
  const newDeck = [...pl.deck.slice(0, idx), ...pl.deck.slice(idx + 1)];
  const picksThisRound = { ...match.picksThisRound, [player]: card };

  let next: LocalMatch = {
    ...match,
    [player]: { ...pl, deck: newDeck },
    picksThisRound,
  };

  const other: "player1" | "player2" = player === "player1" ? "player2" : "player1";
  if (!picksThisRound[other]) {
    return { ...next, pickTurn: other };
  }

  return finalizePickedRound(next);
}

function finalizePickedRound(match: LocalMatch): LocalMatch {
  const player1Card = match.picksThisRound.player1;
  const player2Card = match.picksThisRound.player2;
  if (!player1Card || !player2Card) return match;

  const player1Power = player1Card.power || 0;
  const player2Power = player2Card.power || 0;

  let roundWinner: "player1" | "player2" | "tie";
  let p1 = { ...match.player1 };
  let p2 = { ...match.player2 };

  if (player1Power > player2Power) {
    roundWinner = "player1";
    p1 = { ...p1, won: [...p1.won, player1Card, player2Card] };
  } else if (player2Power > player1Power) {
    roundWinner = "player2";
    p2 = { ...p2, won: [...p2.won, player1Card, player2Card] };
  } else {
    roundWinner = "tie";
    p1 = { ...p1, pile: [...p1.pile, player1Card] };
    p2 = { ...p2, pile: [...p2.pile, player2Card] };
  }

  const roundResults = [
    ...match.roundResults,
    {
      round: match.currentRound + 1,
      player1Card,
      player2Card,
      winner: roundWinner,
      player1Power,
      player2Power,
    },
  ];

  const currentRound = match.currentRound + 1;
  const nextLeader: "player1" | "player2" = match.roundLeader === "player1" ? "player2" : "player1";

  let next: LocalMatch = {
    ...match,
    player1: p1,
    player2: p2,
    currentRound,
    roundResults,
    picksThisRound: { player1: null, player2: null },
    roundLeader: nextLeader,
    pickTurn: nextLeader,
  };

  if (
    currentRound >= match.maxRounds ||
    next.player1.deck.length === 0 ||
    next.player2.deck.length === 0
  ) {
    next = { ...next, isActive: false, pickTurn: null };

    const player1Total = next.player1.won.length + next.player1.pile.length;
    const player2Total = next.player2.won.length + next.player2.pile.length;

    if (player1Total > player2Total) {
      next = { ...next, winner: "player1" };
    } else if (player2Total > player1Total) {
      next = { ...next, winner: "player2" };
    } else {
      next = { ...next, winner: "player1" };
    }
  }

  return next;
}

export function getMatchStats(match: LocalMatch) {
  return {
    player1: {
      name: match.player1.name,
      cardsWon: match.player1.won.length,
      cardsRemaining: match.player1.deck.length + match.player1.hand.length,
      totalCards: match.player1.won.length + match.player1.pile.length,
    },
    player2: {
      name: match.player2.name,
      cardsWon: match.player2.won.length,
      cardsRemaining: match.player2.deck.length + match.player2.hand.length,
      totalCards: match.player2.won.length + match.player2.pile.length,
    },
    currentRound: match.currentRound,
    maxRounds: match.maxRounds,
    isActive: match.isActive,
    winner: match.winner,
    pickTurn: match.pickTurn,
    roundLeader: match.roundLeader,
    picksThisRound: match.picksThisRound,
  };
}

export function getWinnerInfo(match: LocalMatch) {
  if (!match.winner) return null;

  const winner = match.winner === "player1" ? match.player1 : match.player2;
  const loser = match.winner === "player1" ? match.player2 : match.player1;

  return {
    winner: {
      name: winner.name,
      nftsWon: [...winner.won, ...winner.pile],
      totalNfts: winner.won.length + winner.pile.length,
    },
    loser: {
      name: loser.name,
      nftsLost: [...loser.won, ...loser.pile],
      totalNfts: loser.won.length + loser.pile.length,
    },
    roundsPlayed: match.currentRound,
  };
}

/**
 * NFTs that the match winner actually took from the opponent — one card per round they won
 * (excludes the winner's own played card and tie rounds).
 */
export function getNftsCapturedFromOpponent(match: LocalMatch): GameCard[] {
  if (!match.winner) return [];
  const slot = match.winner;
  const out: GameCard[] = [];
  for (const r of match.roundResults) {
    if (r.winner !== slot) continue;
    const fromOpponent = slot === "player1" ? r.player2Card : r.player1Card;
    out.push(fromOpponent);
  }
  return out;
}
