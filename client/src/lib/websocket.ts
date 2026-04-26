/**
 * WebSocket utilities for real-time matchmaking and multiplayer gameplay
 */

export interface MatchmakingMessage {
  type:
    | 'join_queue'
    | 'leave_queue'
    | 'match_found'
    | 'match_start'
    | 'player_action'
    | 'match_end'
    | 'error'
    | 'rejoin_room'
    | 'game_state';
  playerId: string;
  roomId?: string;
  deckSize?: number;
  payload?: Record<string, any>;
  timestamp?: number;
}

export interface MatchRoom {
  roomId: string;
  players: Array<{
    playerId: string;
    deckSize: number;
    status: 'waiting' | 'ready' | 'playing' | 'finished';
    joinedAt: number;
  }>;
  status: 'waiting' | 'active' | 'finished';
  createdAt: number;
  matchData?: {
    currentRound: number;
    playerScores: Record<string, number>;
  };
}

export interface QueueEntry {
  playerId: string;
  deckSize: number;
  joinedAt: number;
}

class MatchmakingService {
  private ws: WebSocket | null = null;
  private url: string;
  private playerId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private messageHandlers: Map<string, Set<(msg: MatchmakingMessage) => void>> = new Map();
  private connectionHandlers: Array<(connected: boolean) => void> = [];

  constructor(playerId: string, wsUrl?: string) {
    this.playerId = playerId;
    // Use current location for WebSocket URL if not provided
    const envWs = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
  if (wsUrl) {
    this.url = wsUrl;
  } else if (envWs) {
    const sep = envWs.includes("?") ? "&" : "?";
    this.url = `${envWs}${sep}playerId=${encodeURIComponent(playerId)}`;
  } else {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const base = `${protocol}//${window.location.host}/ws/matchmaking`;
    this.url = `${base}?playerId=${encodeURIComponent(playerId)}`;
  }
}

  /**
   * Connect to WebSocket server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('Connected to matchmaking server');
          this.reconnectAttempts = 0;
          this.notifyConnectionHandlers(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: MatchmakingMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('Disconnected from matchmaking server');
          this.notifyConnectionHandlers(false);
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Join matchmaking queue
   */
  public joinQueue(deckSize: number): void {
    const message: MatchmakingMessage = {
      type: 'join_queue',
      playerId: this.playerId,
      deckSize,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  /**
   * Leave matchmaking queue
   */
  public leaveQueue(): void {
    const message: MatchmakingMessage = {
      type: 'leave_queue',
      playerId: this.playerId,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  /**
   * Send player action during match
   */
  public sendPlayerAction(roomId: string, action: Record<string, any>): void {
    const message: MatchmakingMessage = {
      type: 'player_action',
      playerId: this.playerId,
      roomId,
      payload: action,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  /**
   * Re-enter a room after navigation (send deck so the server can start the match).
   */
  public sendRejoinRoom(roomId: string, deck: Array<{ assetId: string; imageUri: string; name?: string; power: number }>): void {
    const message: MatchmakingMessage = {
      type: 'rejoin_room',
      playerId: this.playerId,
      roomId,
      payload: { deck },
      timestamp: Date.now(),
    };
    this.send(message);
  }

  /**
   * End match
   */
  public endMatch(roomId: string, result: 'win' | 'loss' | 'draw'): void {
    const message: MatchmakingMessage = {
      type: 'match_end',
      playerId: this.playerId,
      roomId,
      payload: { result },
      timestamp: Date.now(),
    };
    this.send(message);
  }

  /**
   * Register message handler for specific message type. Returns an unsubscribe function.
   */
  public on(type: string, handler: (msg: MatchmakingMessage) => void): () => void {
    let set = this.messageHandlers.get(type);
    if (!set) {
      set = new Set();
      this.messageHandlers.set(type, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
      if (set!.size === 0) this.messageHandlers.delete(type);
    };
  }

  /**
   * Register connection status handler
   */
  public onConnectionChange(handler: (connected: boolean) => void): void {
    this.connectionHandlers.push(handler);
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Private: Send message to server
   */
  private send(message: MatchmakingMessage): void {
    if (!this.isConnected()) {
      console.warn('WebSocket not connected, cannot send message');
      return;
    }
    this.ws!.send(JSON.stringify(message));
  }

  /**
   * Private: Handle incoming message
   */
  private handleMessage(message: MatchmakingMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    handlers?.forEach((h) => h(message));
  }

  /**
   * Private: Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }, this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  /**
   * Private: Notify connection handlers
   */
  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach((handler) => handler(connected));
  }
}

// Create singleton instance
let matchmakingService: MatchmakingService | null = null;

export function getMatchmakingService(playerId: string, wsUrl?: string): MatchmakingService {
  if (!matchmakingService) {
    matchmakingService = new MatchmakingService(playerId, wsUrl);
  }
  return matchmakingService;
}

export function resetMatchmakingService(): void {
  if (matchmakingService) {
    matchmakingService.disconnect();
    matchmakingService = null;
  }
}
