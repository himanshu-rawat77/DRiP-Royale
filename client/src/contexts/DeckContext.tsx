import React, { createContext, useContext, useState, useCallback } from 'react';
import type { GameCard, LedgerEntry } from '@/lib/types';

interface DeckContextType {
  selectedDeck: GameCard[] | null;
  setSelectedDeck: (deck: GameCard[]) => void;
  deckSize: number;
  setDeckSize: (size: number) => void;
  walletAddress: string | null;
  setWalletAddress: (address: string | null) => void;
  ledger: LedgerEntry[];
  addLedgerEntry: (entry: LedgerEntry) => void;
  clearDeck: () => void;
}

const DeckContext = createContext<DeckContextType | undefined>(undefined);

export function DeckProvider({ children }: { children: React.ReactNode }) {
  const [selectedDeck, setSelectedDeck] = useState<GameCard[] | null>(null);
  const [deckSize, setDeckSize] = useState(5);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const addLedgerEntry = useCallback((entry: LedgerEntry) => {
    setLedger((prev) => [entry, ...prev]);
  }, []);

  const clearDeck = useCallback(() => {
    setSelectedDeck(null);
  }, []);

  const value: DeckContextType = {
    selectedDeck,
    setSelectedDeck,
    deckSize,
    setDeckSize,
    walletAddress,
    setWalletAddress,
    ledger,
    addLedgerEntry,
    clearDeck,
  };

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDeck() {
  const context = useContext(DeckContext);
  if (!context) {
    throw new Error('useDeck must be used within DeckProvider');
  }
  return context;
}
