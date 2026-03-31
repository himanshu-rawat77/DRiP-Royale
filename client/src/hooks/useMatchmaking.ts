import { useState, useCallback, useEffect, useRef } from 'react';
import { getMatchmakingService, type MatchmakingMessage, type MatchRoom } from '@/lib/websocket';

export interface MatchmakingState {
  playerId: string;
  isConnected: boolean;
  inQueue: boolean;
  currentRoom: MatchRoom | null;
  queueWaitTime: number;
  error: string | null;
}

export function useMatchmaking(playerId: string) {
  const [state, setState] = useState<MatchmakingState>({
    playerId,
    isConnected: false,
    inQueue: false,
    currentRoom: null,
    queueWaitTime: 0,
    error: null,
  });

  const queueStartTimeRef = useRef<number | null>(null);

  // Initialize matchmaking service (stays connected when navigating to Arena for multiplayer sync)
  useEffect(() => {
    const service = getMatchmakingService(playerId);

    const unsubs: Array<() => void> = [
      service.on('match_found', (msg: MatchmakingMessage) => {
        setState((prev) => ({
          ...prev,
          inQueue: false,
          currentRoom: msg.payload as MatchRoom,
          queueWaitTime: msg.timestamp ? Date.now() - msg.timestamp : 0,
        }));
        queueStartTimeRef.current = null;
      }),
      service.on('match_start', (msg: MatchmakingMessage) => {
        setState((prev) => ({
          ...prev,
          currentRoom: msg.payload as MatchRoom,
        }));
      }),
      service.on('match_end', () => {
        setState((prev) => ({
          ...prev,
          currentRoom: null,
        }));
      }),
      service.on('error', (msg: MatchmakingMessage) => {
        setState((prev) => ({
          ...prev,
          error: msg.payload?.message || 'An error occurred',
        }));
      }),
    ];

    service.onConnectionChange((connected: boolean) => {
      setState((prev) => ({
        ...prev,
        isConnected: connected,
        error: connected ? null : 'Connection lost',
      }));
    });

    service.connect().catch((error) => {
      console.error('Failed to connect to matchmaking server:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to connect to matchmaking server',
      }));
    });

    const interval = setInterval(() => {
      const start = queueStartTimeRef.current;
      if (start) {
        setState((prev) => ({
          ...prev,
          queueWaitTime: Date.now() - start,
        }));
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      unsubs.forEach((u) => u());
    };
  }, [playerId]);

  const joinQueue = useCallback(
    (deckSize: number) => {
      const service = getMatchmakingService(playerId);
      if (service.isConnected()) {
        setState((prev) => ({
          ...prev,
          inQueue: true,
          error: null,
        }));
        queueStartTimeRef.current = Date.now();
        service.joinQueue(deckSize);
      } else {
        setState((prev) => ({
          ...prev,
          error: 'Not connected to matchmaking server',
        }));
      }
    },
    [playerId]
  );

  const leaveQueue = useCallback(() => {
    const service = getMatchmakingService(playerId);
    if (service.isConnected()) {
      setState((prev) => ({
        ...prev,
        inQueue: false,
      }));
      queueStartTimeRef.current = null;
      service.leaveQueue();
    }
  }, [playerId]);

  const sendPlayerAction = useCallback(
    (action: Record<string, any>) => {
      const service = getMatchmakingService(playerId);
      if (service.isConnected() && state.currentRoom) {
        service.sendPlayerAction(state.currentRoom.roomId, action);
      }
    },
    [playerId, state.currentRoom]
  );

  const endMatch = useCallback(
    (result: 'win' | 'loss' | 'draw') => {
      const service = getMatchmakingService(playerId);
      if (service.isConnected() && state.currentRoom) {
        service.endMatch(state.currentRoom.roomId, result);
      }
    },
    [playerId, state.currentRoom]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  return {
    ...state,
    joinQueue,
    leaveQueue,
    sendPlayerAction,
    endMatch,
    clearError,
  };
}
