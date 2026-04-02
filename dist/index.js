// server/index.ts
import express2 from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

// server/matchmaking-ws.ts
import { WebSocketServer } from "ws";
import { nanoid } from "nanoid";

// shared/matchEngine.ts
function initializeLocalMatch(player1Deck, player2Deck, player1Name = "Player 1", player2Name = "Player 2") {
  return {
    id: `match-${Date.now()}`,
    player1: {
      name: player1Name,
      deck: [...player1Deck].sort(() => Math.random() - 0.5),
      hand: [],
      won: [],
      pile: []
    },
    player2: {
      name: player2Name,
      deck: [...player2Deck].sort(() => Math.random() - 0.5),
      hand: [],
      won: [],
      pile: []
    },
    currentRound: 0,
    maxRounds: Math.min(player1Deck.length, player2Deck.length),
    isActive: true,
    winner: null,
    pickTurn: "player1",
    roundLeader: "player1",
    picksThisRound: { player1: null, player2: null },
    roundResults: []
  };
}
function submitPick(match, player, assetId) {
  if (!match.isActive || match.pickTurn !== player || match.picksThisRound[player]) {
    return match;
  }
  const pl = match[player];
  const idx = pl.deck.findIndex((c) => c.assetId === assetId);
  if (idx < 0) return match;
  const card = pl.deck[idx];
  const newDeck = [...pl.deck.slice(0, idx), ...pl.deck.slice(idx + 1)];
  const picksThisRound = { ...match.picksThisRound, [player]: card };
  let next = {
    ...match,
    [player]: { ...pl, deck: newDeck },
    picksThisRound
  };
  const other = player === "player1" ? "player2" : "player1";
  if (!picksThisRound[other]) {
    return { ...next, pickTurn: other };
  }
  return finalizePickedRound(next);
}
function finalizePickedRound(match) {
  const player1Card = match.picksThisRound.player1;
  const player2Card = match.picksThisRound.player2;
  if (!player1Card || !player2Card) return match;
  const player1Power = player1Card.power || 0;
  const player2Power = player2Card.power || 0;
  let roundWinner;
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
      player2Power
    }
  ];
  const currentRound = match.currentRound + 1;
  const nextLeader = match.roundLeader === "player1" ? "player2" : "player1";
  let next = {
    ...match,
    player1: p1,
    player2: p2,
    currentRound,
    roundResults,
    picksThisRound: { player1: null, player2: null },
    roundLeader: nextLeader,
    pickTurn: nextLeader
  };
  if (currentRound >= match.maxRounds || next.player1.deck.length === 0 || next.player2.deck.length === 0) {
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

// server/custody-keypair.ts
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
var cached;
function getCustodyKeypair() {
  if (cached !== void 0) return cached;
  const secret = process.env.CUSTODY_PRIVATE_KEY?.trim();
  if (!secret) {
    cached = null;
    return null;
  }
  try {
    const secretKey = bs58.decode(secret);
    if (secretKey.length !== 64 && secretKey.length !== 32) {
      console.error("[custody] CUSTODY_PRIVATE_KEY must decode to 32 or 64 bytes");
      cached = null;
      return null;
    }
    cached = Keypair.fromSecretKey(secretKey);
  } catch (e) {
    console.error("[custody] Failed to parse CUSTODY_PRIVATE_KEY", e);
    cached = null;
  }
  return cached;
}
function custodyEscrowEnabled() {
  return getCustodyKeypair() !== null;
}
function getCustodyPubkeyBase58() {
  const k = getCustodyKeypair();
  return k ? k.publicKey.toBase58() : null;
}

// server/escrow-settlement.ts
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, publicKey } from "@metaplex-foundation/umi";
import { mplBubblegum, getAssetWithProof, transfer } from "@metaplex-foundation/mpl-bubblegum";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";

// shared/heliusRpc.ts
function getHeliusRpcUrl(parts) {
  const network = parts.network === "mainnet-beta" ? "mainnet-beta" : "devnet";
  const base = network === "mainnet-beta" ? "https://mainnet.helius-rpc.com" : "https://devnet.helius-rpc.com";
  const key = parts.apiKey?.trim();
  return key && key !== "devnet" ? `${base}/?api-key=${key}` : base;
}

// server/helius-rpc.ts
function getServerHeliusRpcUrl() {
  const apiKey = process.env.HELIUS_API_KEY || process.env.VITE_HELIUS_API_KEY;
  const network = process.env.SOLANA_NETWORK || process.env.VITE_SOLANA_NETWORK;
  return getHeliusRpcUrl({ apiKey, network });
}

// server/escrow-settlement.ts
function collectAssetIds(match, slot) {
  const p = match[slot];
  const all = [...p.deck, ...p.hand, ...p.won, ...p.pile];
  return Array.from(new Set(all.map((c) => c.assetId)));
}
async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function settleEscrowAfterMatch(match, playerIds, playerWallets) {
  if (!match.winner) return;
  const custody = getCustodyKeypair();
  if (!custody) return;
  const wA = playerWallets[playerIds[0]];
  const wB = playerWallets[playerIds[1]];
  if (!wA || !wB) {
    console.error("[escrow] Missing wallet addresses for settlement");
    return;
  }
  const rpc = getServerHeliusRpcUrl();
  const umi = createUmi(rpc).use(mplBubblegum()).use(dasApi());
  umi.use(keypairIdentity(fromWeb3JsKeypair(custody)));
  const winnerSlot = match.winner;
  const loserSlot = winnerSlot === "player1" ? "player2" : "player1";
  const winnerWallet = winnerSlot === "player1" ? wA : wB;
  const loserWallet = loserSlot === "player1" ? wA : wB;
  const toWinner = collectAssetIds(match, winnerSlot);
  const toLoser = collectAssetIds(match, loserSlot);
  for (const assetId of toWinner) {
    try {
      const proof = await getAssetWithProof(umi, publicKey(assetId));
      await transfer(umi, {
        ...proof,
        leafOwner: umi.identity,
        newLeafOwner: publicKey(winnerWallet)
      }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });
    } catch (e) {
      console.error(`[escrow] transfer to winner failed ${assetId}`, e);
    }
    await sleep(400);
  }
  for (const assetId of toLoser) {
    try {
      const proof = await getAssetWithProof(umi, publicKey(assetId));
      await transfer(umi, {
        ...proof,
        leafOwner: umi.identity,
        newLeafOwner: publicKey(loserWallet)
      }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });
    } catch (e) {
      console.error(`[escrow] transfer to loser failed ${assetId}`, e);
    }
    await sleep(400);
  }
  console.log(`[escrow] settlement finished for match ${match.id}`);
}

// server/escrow-registry.ts
var registrar = null;
function setEscrowRegistrar(next) {
  registrar = next;
}
function getEscrowRegistrar() {
  return registrar;
}

// server/matchmaking-ws.ts
function safeSend(ws, message) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(message));
}
function now() {
  return Date.now();
}
function createMatchmakingWsServer() {
  const wss = new WebSocketServer({ noServer: true });
  const clientsByWs = /* @__PURE__ */ new Map();
  const clientsByPlayerId = /* @__PURE__ */ new Map();
  const queue = [];
  const rooms = /* @__PURE__ */ new Map();
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
    }
  });
  function escrowDepositsSatisfied(room) {
    if (!custodyEscrowEnabled()) return true;
    const [aId, bId] = room.players;
    return !!room.escrow.depositOk[aId] && !!room.escrow.depositOk[bId];
  }
  function broadcastGameState(room) {
    if (!room.match) return;
    const [aId, bId] = room.players;
    for (const pid of [aId, bId]) {
      const c = clientsByPlayerId.get(pid);
      if (!c || c.ws.readyState !== c.ws.OPEN) continue;
      const youAre = pid === aId ? "player1" : "player2";
      safeSend(c.ws, {
        type: "game_state",
        playerId: pid,
        roomId: room.roomId,
        timestamp: now(),
        payload: { match: room.match, youAre }
      });
    }
  }
  function tryStartRoomMatch(room) {
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
  function removeFromQueue(playerId) {
    const idx = queue.indexOf(playerId);
    if (idx >= 0) queue.splice(idx, 1);
  }
  function getOpponentInRoom(roomId, playerId) {
    const room = rooms.get(roomId);
    if (!room) return void 0;
    const otherId = room.players[0] === playerId ? room.players[1] : room.players[0];
    return clientsByPlayerId.get(otherId);
  }
  function tryMatchmake() {
    while (queue.length >= 2) {
      const aId = queue.shift();
      const bId = queue.shift();
      const a = clientsByPlayerId.get(aId);
      const b = clientsByPlayerId.get(bId);
      if (!a || !b) continue;
      if (a.roomId || b.roomId) continue;
      if (a.ws.readyState !== a.ws.OPEN || b.ws.readyState !== b.ws.OPEN) continue;
      const roomId = nanoid(10);
      const room = {
        roomId,
        players: [aId, bId],
        createdAt: now(),
        decks: {},
        match: null,
        escrow: { playerWallets: {}, depositOk: {}, settled: false }
      };
      rooms.set(roomId, room);
      a.roomId = roomId;
      b.roomId = roomId;
      console.log(`[matchmaking-ws] match created roomId=${roomId} a=${aId} b=${bId}`);
      const roomPayload = {
        roomId,
        createdAt: room.createdAt,
        status: "active",
        players: [
          { playerId: aId, deckSize: a.deckSize ?? 0, status: "ready", joinedAt: room.createdAt },
          { playerId: bId, deckSize: b.deckSize ?? 0, status: "ready", joinedAt: room.createdAt }
        ],
        matchData: { currentRound: 1, playerScores: { [aId]: 0, [bId]: 0 } }
      };
      const base = { roomId, timestamp: now(), payload: roomPayload };
      safeSend(a.ws, { type: "match_found", playerId: a.playerId, ...base });
      safeSend(b.ws, { type: "match_found", playerId: b.playerId, ...base });
      safeSend(a.ws, { type: "match_start", playerId: a.playerId, ...base });
      safeSend(b.ws, { type: "match_start", playerId: b.playerId, ...base });
    }
  }
  function onMessage(client, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      safeSend(client.ws, {
        type: "error",
        playerId: client.playerId,
        timestamp: now(),
        payload: { message: "Invalid JSON" }
      });
      return;
    }
    if (!msg || typeof msg !== "object") return;
    if (msg.type !== "rejoin_room" && msg.playerId && msg.playerId !== client.playerId) {
      safeSend(client.ws, {
        type: "error",
        playerId: client.playerId,
        timestamp: now(),
        payload: { message: "playerId mismatch for this connection" }
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
            payload: { message: "Already in a match" }
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
            payload: { message: "Invalid room or not a member of this room" }
          });
          return;
        }
        client.roomId = roomId;
        const deck = msg.payload?.deck;
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
          const slot = room.players[0] === client.playerId ? "player1" : "player2";
          room.match = submitPick(room.match, slot, msg.payload.assetId);
          broadcastGameState(room);
          if (room.match.winner && custodyEscrowEnabled() && !room.escrow.settled) {
            room.escrow.settled = true;
            const players = [...room.players];
            const wallets = { ...room.escrow.playerWallets };
            const finishedMatch = room.match;
            void settleEscrowAfterMatch(finishedMatch, players, wallets).catch(
              (e) => console.error("[escrow] settlement failed", e)
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
          payload: msg.payload ?? {}
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
        client.roomId = void 0;
        if (opponent) opponent.roomId = void 0;
        if (opponent) {
          safeSend(opponent.ws, {
            type: "match_end",
            playerId: client.playerId,
            roomId,
            timestamp: now(),
            payload: msg.payload ?? {}
          });
        }
        return;
      }
      default:
        return;
    }
  }
  wss.on("connection", (ws, request) => {
    const url = new URL(request.url ?? "", "http://localhost");
    const playerId = url.searchParams.get("playerId") || nanoid(8);
    console.log(`[matchmaking-ws] connected playerId=${playerId} url=${request.url ?? ""}`);
    const state = { ws, playerId };
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
          opponent.roomId = void 0;
          safeSend(opponent.ws, {
            type: "match_end",
            playerId: client.playerId,
            roomId,
            timestamp: now(),
            payload: { reason: "opponent_disconnected" }
          });
        }
      }
    });
  });
  return {
    wss,
    handleUpgrade(request, socket, head) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  };
}

// server/escrow-routes.ts
import express, { Router } from "express";

// server/escrow-verify.ts
async function dasGetAsset(rpcUrl, assetId) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "escrow-verify",
      method: "getAsset",
      params: { id: assetId }
    })
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.error?.message) throw new Error(data.error.message);
  return data.result ?? null;
}
function isCompressedNft(asset) {
  if (!asset?.compression) return false;
  if (asset.compression.compressed === true) return true;
  return !!asset.compression.data_hash;
}
async function verifyCompressedAssetsInCustody(rpcUrl, custodyPubkey, assetIds) {
  for (const id of assetIds) {
    try {
      const asset = await dasGetAsset(rpcUrl, id);
      if (!asset) {
        return { ok: false, error: `Asset not found: ${id}` };
      }
      if (!isCompressedNft(asset)) {
        return {
          ok: false,
          error: `Escrow supports compressed NFTs only. Asset ${id} is not compressed.`
        };
      }
      const owner = asset.ownership?.owner;
      if (owner !== custodyPubkey) {
        return {
          ok: false,
          error: `Asset ${id} is not in custody (expected ${custodyPubkey}, got ${owner ?? "none"}).`
        };
      }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : `Verification failed for ${id}`
      };
    }
  }
  return { ok: true };
}

// server/escrow-routes.ts
function createEscrowRouter() {
  const r = Router();
  r.use(express.json({ limit: "512kb" }));
  const sendJson = (res, status, payload) => {
    if (typeof res?.status === "function" && typeof res?.json === "function") {
      res.status(status).json(payload);
      return;
    }
    if (typeof res?.writeHead === "function") {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }
    res.statusCode = status;
    if (typeof res?.setHeader === "function") res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  };
  r.get("/config", (_req, res) => {
    const enabled = custodyEscrowEnabled();
    sendJson(res, 200, {
      enabled,
      custodyPubkey: enabled ? getCustodyPubkeyBase58() : null
    });
  });
  r.post("/confirm", async (req, res) => {
    if (!custodyEscrowEnabled()) {
      sendJson(res, 400, { error: "Custody escrow is not configured" });
      return;
    }
    const body = req.body;
    const { roomId, playerId, walletAddress, assetIds } = body;
    if (!roomId || !playerId || !walletAddress || !Array.isArray(assetIds) || assetIds.length === 0) {
      sendJson(res, 400, { error: "Invalid body" });
      return;
    }
    const reg = getEscrowRegistrar();
    if (!reg || !reg.roomHasPlayer(roomId, playerId)) {
      sendJson(res, 400, { error: "Room not found or player not in room" });
      return;
    }
    const custody = getCustodyPubkeyBase58();
    if (!custody) {
      sendJson(res, 500, { error: "Custody misconfigured" });
      return;
    }
    const verify = await verifyCompressedAssetsInCustody(getServerHeliusRpcUrl(), custody, assetIds);
    if (!verify.ok) {
      sendJson(res, 400, { error: verify.error });
      return;
    }
    reg.markDepositReady(roomId, playerId, walletAddress);
    sendJson(res, 200, { ok: true });
  });
  return r;
}

// server/index.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
async function startServer() {
  const app = express2();
  const server = createServer(app);
  const matchmaking = createMatchmakingWsServer();
  app.use("/api/escrow", createEscrowRouter());
  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    if (url.startsWith("/ws/matchmaking")) {
      matchmaking.handleUpgrade(req, socket, head);
      return;
    }
  });
  const staticPath = process.env.NODE_ENV === "production" ? path.resolve(__dirname, "public") : path.resolve(__dirname, "..", "dist", "public");
  app.use(express2.static(staticPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
  const port = process.env.PORT || 3e3;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
