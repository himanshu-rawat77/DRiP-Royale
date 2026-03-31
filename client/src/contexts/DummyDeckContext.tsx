import React, { createContext, useContext, useState } from 'react';
import { NFT_CARDS } from '@/lib/cardData';

type NftCard = (typeof NFT_CARDS)[number];

interface DummyDeckContextType {
  isDummyMode: boolean;
  setIsDummyMode: (value: boolean) => void;
  dummyDeck: typeof NFT_CARDS;
  selectedDummyCards: NftCard[];
  addDummyCard: (card: NftCard) => void;
  removeDummyCard: (cardId: string) => void;
  clearDummyDeck: () => void;
}

const DummyDeckContext = createContext<DummyDeckContextType | undefined>(undefined);

export function DummyDeckProvider({ children }: { children: React.ReactNode }) {
  const [isDummyMode, setIsDummyMode] = useState(false);
  const [selectedDummyCards, setSelectedDummyCards] = useState<NftCard[]>([]);

  const addDummyCard = (card: NftCard) => {
    if (selectedDummyCards.length < 52) {
      setSelectedDummyCards([...selectedDummyCards, card]);
    }
  };

  const removeDummyCard = (cardId: string) => {
    setSelectedDummyCards(selectedDummyCards.filter((c) => c.id.toString() !== cardId));
  };

  const clearDummyDeck = () => {
    setSelectedDummyCards([]);
  };

  return (
    <DummyDeckContext.Provider
      value={{
        isDummyMode,
        setIsDummyMode,
        dummyDeck: NFT_CARDS,
        selectedDummyCards,
        addDummyCard,
        removeDummyCard,
        clearDummyDeck,
      }}
    >
      {children}
    </DummyDeckContext.Provider>
  );
}

export function useDummyDeck() {
  const context = useContext(DummyDeckContext);
  if (!context) {
    throw new Error('useDummyDeck must be used within DummyDeckProvider');
  }
  return context;
}
