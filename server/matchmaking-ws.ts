import type { IncomingMessage } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { nanoid } from "nanoid";
import {
  initializeLocalMatch,
  submitPick,
  type GameCard,
  type LocalMatch,
} from "../shared/matchEngine";
import { custodyEscrowEnabled } from "./custody-keypair";
import { settleEscrowAfterMatch } from "./escrow-settlement";
import { setEscrowRegistrar } from "./escrow-registry";

type MatchmakingMessage = {
  type:
    | "join_queue"
    | "leave_queue"
    | "match_found"
    | "match_start"
    | "player_action"
    | "match_end"
    | "error"
    | "rejoin_room"
    | "game_state";
  playerId: string;
  roomId?: string;
  deckSize?: number;
  payload?: Record<string, any>;
  timestamp?: number;
};

type ClientState = {
  ws: WebSocket;
  playerId: string;
  deckSize?: number;
  roomId?: string;
};

type RoomState = {
  roomId: string;
  players: [string, string];
  createdAt: number;
  decks: Partial<Record<string, GameCard[]>>;
  match: LocalMatch | null;
  escrow: {
    playerWallets: Partial<Record<string, string>>;
    depositOk: Partial<Record<string, boolean>>;
    settled: boolean;
  };
};

type MatchRoom = {
  roomId: string;
  players: Array<{
    playerId: string;
    deckSize: number;
    status: "waiting" | "ready" | "playing" | "finished";
    joinedAt: number;
  }>;
  status: "waiting" | "active" | "finished";
  createdAt: number;
  matchData?: {
    currentRound: number;
    playerScores: Record<string, number>;
  };
};

function safeSend(ws: WebSocket, message: MatchmakingMessage) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(message));
}

function now() {
  return Date.now();
}

export function createMatchmakingWsServer() {
  const wss = new WebSocketServer({ noServer: true });

  const clientsByWs = new Map<WebSocket, ClientState>();
  const clientsByPlayerId = new Map<string, ClientState>();
  const queue: string[] = [];
  const rooms = new Map<string, RoomState>();

  setEscrowRegistrar({
    markDepositReady(roomId, playerId, wallet) {
      const room = rooms.get(roomId);
      if (!room || !room.players.includes(playerId)) return;
      room.escrow.playerWallets[playerId] = wallet;
      room.escrow.depositOk[playerId] = true;
      tryStartRoomMatch(room);
    },
    roomHasPlayer(roomId, playerId) {
      const room = rooms.get(roomId);
      return !!room && room.players.includes(playerId);
    },
  });

  function escrowDepositsSatisfied(room: RoomState): boolean {
    if (!custodyEscrowEnabled()) return true;
    const [aId, bId] = room.players;
    return !!room.escrow.depositOk[aId] && !!room.escrow.depositOk[bId];
  }

  function broadcastGameState(room: RoomState) {
    if (!room.match) return;
    const [aId, bId] = room.players;
    for (const pid of [aId, bId]) {
      const c = clientsByPlayerId.get(pid);
      if (!c || c.ws.readyState !== c.ws.OPEN) continue;
      const youAre: "player1" | "player2" = pid === aId ? "player1" : "player2";
      safeSend(c.ws, {
        type: "game_state",
        playerId: pid,
        roomId: room.roomId,
        timestamp: now(),
        payload: { match: room.match, youAre },
      });
    }
  }

  function tryStartRoomMatch(room: RoomState) {
    if (room.match) return;
    if (!escrowDepositsSatisfied(room)) return;
    const [aId, bId] = room.players;
    const da = room.decks[aId];
    const db = room.decks[bId];
    if (!da?.length || !db?.length) return;
    room.match = initializeLocalMatch(da, db, aId, bId);
    console.log(`[matchmaking-ws] match started in room ${room.roomId}`);
    broadcastGameState(room);
  }

  function removeFromQueue(playerId: string) {
    const idx = queue.indexOf(playerId);
    if (idx >= 0) queue.splice(idx, 1);
  }

  function getOpponentInRoom(roomId: string, playerId: string): ClientState | undefined {
    const room = rooms.get(roomId);
    if (!room) return undefined;
    const otherId = room.players[0] === playerId ? room.players[1] : room.players[0];
    return clientsByPlayerId.get(otherId);
  }

  function tryMatchmake() {
    while (queue.length >= 2) {
      const aId = queue.shift()!;
      const bId = queue.shift()!;

      const a = clientsByPlayerId.get(aId);
      const b = clientsByPlayerId.get(bId);
      if (!a || !b) continue;
      if (a.roomId || b.roomId) continue;
      if (a.ws.readyState !== a.ws.OPEN || b.ws.readyState !== b.ws.OPEN) continue;

      const roomId = nanoid(10);
      const room: RoomState = {
        roomId,
        players: [aId, bId],
        createdAt: now(),
        decks: {},
        match: null,
        escrow: { playerWallets: {}, depositOk: {}, settled: false },
      };
      rooms.set(roomId, room);
      a.roomId = roomId;
      b.roomId = roomId;
      console.log(`[matchmaking-ws] match created roomId=${roomId} a=${aId} b=${bId}`);

      const roomPayload: MatchRoom = {
        roomId,
        createdAt: room.createdAt,
        status: "active",
        players: [
          { playerId: aId, deckSize: a.deckSize ?? 0, status: "ready", joinedAt: room.createdAt },
          { playerId: bId, deckSize: b.deckSize ?? 0, status: "ready", joinedAt: room.createdAt },
        ],
        matchData: { currentRound: 1, playerScores: { [aId]: 0, [bId]: 0 } },
      };

      const base = { roomId, timestamp: now(), payload: roomPayload };
      safeSend(a.ws, { type: "match_found", playerId: a.playerId, ...base });
      safeSend(b.ws, { type: "match_found", playerId: b.playerId, ...base });
      safeSend(a.ws, { type: "match_start", playerId: a.playerId, ...base });
      safeSend(b.ws, { type: "match_start", playerId: b.playerId, ...base });
    }
  }

  function onMessage(client: ClientState, raw: string) {
    let msg: MatchmakingMessage | undefined;
    try {
      msg = JSON.parse(raw);
    } catch {
      safeSend(client.ws, {
        type: "error",
        playerId: client.playerId,
        timestamp: now(),
        payload: { message: "Invalid JSON" },
      });
      return;
    }

    if (!msg || typeof msg !== "object") return;

    if (msg.type !== "rejoin_room" && msg.playerId && msg.playerId !== client.playerId) {
      safeSend(client.ws, {
        type: "error",
        playerId: client.playerId,
        timestamp: now(),
        payload: { message: "playerId mismatch for this connection" },
      });
      return;
    }

    switch (msg.type) {
      case "join_queue": {
        console.log(`[matchmaking-ws] join_queue playerId=${client.playerId} deckSize=${msg.deckSize ?? "?"}`);
        if (client.roomId) {
          safeSend(client.ws, {
            type: "error",
            playerId: client.playerId,
            timestamp: now(),
            payload: { message: "Already in a match" },
          });
          return;
        }
        client.deckSize = msg.deckSize;
        removeFromQueue(client.playerId);
        queue.push(client.playerId);
        console.log(`[matchmaking-ws] queue size=${queue.length}`);
        tryMatchmake();
        return;
      }
      case "leave_queue": {
        console.log(`[matchmaking-ws] leave_queue playerId=${client.playerId}`);
        removeFromQueue(client.playerId);
        return;
      }
      case "rejoin_room": {
        const roomId = msg.roomId;
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(client.playerId)) {
          safeSend(client.ws, {
            type: "error",
            playerId: client.playerId,
            timestamp: now(),
            payload: { message: "Invalid room or not a member of this room" },
          });
          return;
        }
        client.roomId = roomId;
        const deck = msg.payload?.deck as GameCard[] | undefined;
        if (deck && Array.isArray(deck) && deck.length > 0) {
          room.decks[client.playerId] = deck.map((c) => ({ ...c }));
        }
        if (room.match) {
          broadcastGameState(room);
          return;
        }
        tryStartRoomMatch(room);
        return;
      }
      case "player_action": {
        const roomId = msg.roomId ?? client.roomId;
        if (!roomId) return;
        const room = rooms.get(roomId);
        const action = msg.payload?.action;

        if (room?.match && action === "pick" && typeof msg.payload?.assetId === "string") {
          const slot: "player1" | "player2" =
            room.players[0] === client.playerId ? "player1" : "player2";
          room.match = submitPick(room.match, slot, msg.payload.assetId as string);
          broadcastGameState(room);
          if (room.match.winner && custodyEscrowEnabled() && !room.escrow.settled) {
            room.escrow.settled = true;
            const players = [...room.players] as [string, string];
            const wallets = { ...room.escrow.playerWallets };
            const finishedMatch = room.match;
            void settleEscrowAfterMatch(finishedMatch, players, wallets).catch((e) =>
              console.error("[escrow] settlement failed", e)
            );
          }
          return;
        }

        const opponent = getOpponentInRoom(roomId, client.playerId);
        if (!opponent) return;
        safeSend(opponent.ws, {
          type: "player_action",
          playerId: client.playerId,
          roomId,
          timestamp: now(),
          payload: msg.payload ?? {},
        });
        return;
      }
      case "match_end": {
        const roomId = msg.roomId ?? client.roomId;
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room) return;
        const opponent = getOpponentInRoom(roomId, client.playerId);

        rooms.delete(roomId);
        client.roomId = undefined;
        if (opponent) opponent.roomId = undefined;

        if (opponent) {
          safeSend(opponent.ws, {
            type: "match_end",
            playerId: client.playerId,
            roomId,
            timestamp: now(),
            payload: msg.payload ?? {},
          });
        }
        return;
      }
      default:
        return;
    }
  }

  wss.on("connection", (ws, request: IncomingMessage) => {
    const url = new URL(request.url ?? "", "http://localhost");
    const playerId = url.searchParams.get("playerId") || nanoid(8);
    console.log(`[matchmaking-ws] connected playerId=${playerId} url=${request.url ?? ""}`);

    const state: ClientState = { ws, playerId };
    clientsByWs.set(ws, state);
    clientsByPlayerId.set(playerId, state);

    ws.on("message", (data) => {
      const client = clientsByWs.get(ws);
      if (!client) return;
      onMessage(client, typeof data === "string" ? data : data.toString("utf-8"));
    });

    ws.on("close", () => {
      const client = clientsByWs.get(ws);
      if (!client) return;
      clientsByWs.delete(ws);
      clientsByPlayerId.delete(client.playerId);
      removeFromQueue(client.playerId);

      if (client.roomId) {
        const roomId = client.roomId;
        const opponent = getOpponentInRoom(roomId, client.playerId);
        rooms.delete(roomId);
        if (opponent) {
          opponent.roomId = undefined;
          safeSend(opponent.ws, {
            type: "match_end",
            playerId: client.playerId,
            roomId,
            timestamp: now(),
            payload: { reason: "opponent_disconnected" },
          });
        }
      }
    });
  });

  return {
    wss,
    handleUpgrade(request: IncomingMessage, socket: any, head: Buffer) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    },
  };
}
