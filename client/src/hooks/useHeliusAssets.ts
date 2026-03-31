import { useState, useCallback } from 'react';
import { fetchDripAssetsForDeck } from '@/lib/helius';
import type { GameCard } from '@/lib/types';

export interface UseHeliusAssetsState {
  assets: GameCard[];
  loading: boolean;
  error: string | null;
}

export function useHeliusAssets() {
  const [state, setState] = useState<UseHeliusAssetsState>({
    assets: [],
    loading: false,
    error: null,
  });

  const loadAssets = useCallback(async (walletAddress: string, maxCards: number = 52) => {
    setState({
      assets: [],
      loading: true,
      error: null,
    });

    try {
      // Validate wallet address format
      if (!walletAddress || walletAddress.length < 32) {
        throw new Error('Invalid wallet address');
      }

      const assets = await fetchDripAssetsForDeck(walletAddress, maxCards);

      if (assets.length === 0) {
        setState({
          assets: [],
          loading: false,
          error: 'No DRiP assets found in this wallet',
        });
      } else {
        setState({
          assets,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load assets';
      setState({
        assets: [],
        loading: false,
        error: errorMessage,
      });
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      assets: [],
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    loadAssets,
    clearError,
    reset,
  };
}
