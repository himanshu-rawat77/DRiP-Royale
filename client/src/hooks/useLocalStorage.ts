import { useState, useEffect } from 'react';

/**
 * Custom hook for managing localStorage with React state
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading from localStorage (${key}):`, error);
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage (${key}):`, error);
    }
  };

  const clearValue = () => {
    try {
      setStoredValue(initialValue);
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error clearing localStorage (${key}):`, error);
    }
  };

  return [storedValue, setValue, clearValue];
}

/**
 * Hook for managing wallet address persistence
 */
export function useWalletStorage() {
  return useLocalStorage<string>('drip-wallet-address', '');
}

/**
 * Hook for managing user profile persistence
 */
export function useProfileStorage() {
  const defaultProfile = {
    username: 'Player',
    bio: 'A skilled DRiP Royale warrior',
    profileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Player',
    joinDate: new Date().toLocaleDateString(),
    totalWins: 0,
    totalLosses: 0,
    winRate: 0,
  };
  return useLocalStorage('drip-user-profile', defaultProfile);
}

/**
 * Hook for managing selected deck (wallet NFTs or dummy)
 */
export function useDeckStorage() {
  return useLocalStorage<string[]>('drip-selected-deck', []);
}

/**
 * Hook for managing match state during gameplay
 */
export function useMatchStorage() {
  const defaultMatch = {
    isActive: false,
    isDummy: false,
    player1Deck: [] as string[],
    player2Deck: [] as string[],
    player1Hand: [] as string[],
    player2Hand: [] as string[],
    player1Won: [] as string[],
    player2Won: [] as string[],
    currentRound: 0,
    winner: null as string | null,
  };
  return useLocalStorage('drip-match-state', defaultMatch);
}

/**
 * Hook for managing ledger entries
 */
export function useLedgerStorage() {
  const defaultLedger: Array<{
    id: string;
    opponent: string;
    result: 'WIN' | 'LOSS';
    date: string;
    reward: string;
    nftsWon: string[];
  }> = [];
  return useLocalStorage('drip-ledger', defaultLedger);
}
