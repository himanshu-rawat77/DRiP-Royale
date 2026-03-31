import { useState, useCallback } from 'react';
import { createGameState, playTurn, isGameOver } from '@/lib/warEngine';
import type { GameCard, GameState, DuelResult } from '@/lib/types';

export function useGameState() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lastDuel, setLastDuel] = useState<DuelResult | null>(null);
  const [flipLock, setFlipLock] = useState(false);

  const initializeMatch = useCallback(
    (matchId: string, playerDeck: GameCard[], opponentDeck: GameCard[]) => {
      const state = createGameState(matchId, playerDeck, opponentDeck);
      setGameState(state);
      setLastDuel(null);
      setFlipLock(false);
    },
    []
  );

  const flipCards = useCallback(() => {
    if (!gameState || flipLock || isGameOver(gameState)) {
      return;
    }

    setFlipLock(true);

    // Simulate flip delay for animation
    setTimeout(() => {
      setGameState((prev) => {
        if (!prev) return prev;

        const { state: newState, duel } = playTurn(prev);
        setLastDuel(duel);
        setFlipLock(false);

        return newState;
      });
    }, 800);
  }, [gameState, flipLock]);

  const getPlayerHandSize = useCallback(() => {
    return gameState?.playerHand.length ?? 0;
  }, [gameState]);

  const getOpponentHandSize = useCallback(() => {
    return gameState?.opponentHand.length ?? 0;
  }, [gameState]);

  const getPileSize = useCallback(() => {
    return gameState?.currentPile.length ?? 0;
  }, [gameState]);

  const getMatchStatus = useCallback(() => {
    return gameState?.status ?? 'idle';
  }, [gameState]);

  const isInWar = useCallback(() => {
    return gameState?.inWar ?? false;
  }, [gameState]);

  const getWinRate = useCallback(() => {
    if (!gameState) return { playerWins: 0, opponentWins: 0 };
    const playerWins = gameState.duelHistory.filter((d) => d.winner === 'player').length;
    const opponentWins = gameState.duelHistory.filter((d) => d.winner === 'opponent').length;
    return { playerWins, opponentWins };
  }, [gameState]);

  return {
    gameState,
    lastDuel,
    flipLock,
    initializeMatch,
    flipCards,
    getPlayerHandSize,
    getOpponentHandSize,
    getPileSize,
    getMatchStatus,
    isInWar,
    getWinRate,
  };
}
