// server/index.ts
import express5 from "express";
import { createServer } from "http";
import path2 from "path";
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
  const secret = process.env.CUSTODY_PRIVATE_KEY?.trim() || "22nHooc6ppbyWBtEnCmeWEUM9CJFmQuKNneyvasASoVHCZcdGrwqKQukQFcp8YfqGzeBCDWHTT4UfFJLpydTTgqC";
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
import fs from "node:fs";
import path from "node:path";
var cachedDotEnv = null;
function parseDotEnvFile() {
  if (cachedDotEnv) return cachedDotEnv;
  const out = {};
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) {
      cachedDotEnv = out;
      return out;
    }
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  } catch {
  }
  cachedDotEnv = out;
  return out;
}
function pickEnv(...keys) {
  for (const key of keys) {
    const v = process.env[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  const dot = parseDotEnvFile();
  for (const key of keys) {
    const v = dot[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return void 0;
}
function getServerHeliusRpcUrl() {
  const apiKey = pickEnv("HELIUS_API_KEY", "VITE_HELIUS_API_KEY", "NEXT_PUBLIC_HELIUS_API_KEY");
  const network = pickEnv("SOLANA_NETWORK", "VITE_SOLANA_NETWORK", "NEXT_PUBLIC_SOLANA_NETWORK");
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
  if (!match.winner) {
    return { ok: true, transferredToWinner: [], transferredToLoser: [], failed: [] };
  }
  const custody = getCustodyKeypair();
  if (!custody) {
    return { ok: false, transferredToWinner: [], transferredToLoser: [], failed: [] };
  }
  const wA = playerWallets[playerIds[0]];
  const wB = playerWallets[playerIds[1]];
  if (!wA || !wB) {
    console.error("[escrow] Missing wallet addresses for settlement");
    return {
      ok: false,
      transferredToWinner: [],
      transferredToLoser: [],
      failed: [
        {
          assetId: "wallet-mapping",
          target: "winner",
          error: "Missing wallet addresses for settlement"
        }
      ]
    };
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
  const transferredToWinner = [];
  const transferredToLoser = [];
  const failed = [];
  for (const assetId of toWinner) {
    try {
      const proof = await getAssetWithProof(umi, publicKey(assetId));
      const tx = await transfer(umi, {
        ...proof,
        leafOwner: umi.identity,
        newLeafOwner: publicKey(winnerWallet)
      }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });
      transferredToWinner.push(assetId);
      console.log(`[escrow] transfer to winner ok ${assetId}`, tx);
    } catch (e) {
      console.error(`[escrow] transfer to winner failed ${assetId}`, e);
      failed.push({
        assetId,
        target: "winner",
        error: e instanceof Error ? e.message : String(e)
      });
    }
    await sleep(400);
  }
  for (const assetId of toLoser) {
    try {
      const proof = await getAssetWithProof(umi, publicKey(assetId));
      const tx = await transfer(umi, {
        ...proof,
        leafOwner: umi.identity,
        newLeafOwner: publicKey(loserWallet)
      }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });
      transferredToLoser.push(assetId);
      console.log(`[escrow] transfer to loser ok ${assetId}`, tx);
    } catch (e) {
      console.error(`[escrow] transfer to loser failed ${assetId}`, e);
      failed.push({
        assetId,
        target: "loser",
        error: e instanceof Error ? e.message : String(e)
      });
    }
    await sleep(400);
  }
  const ok = failed.length === 0;
  if (ok) {
    console.log(`[escrow] settlement finished for match ${match.id}`);
  } else {
    console.error(
      `[escrow] settlement incomplete for match ${match.id}. failed=${failed.length}`,
      failed
    );
  }
  return { ok, transferredToWinner, transferredToLoser, failed };
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
            void settleEscrowAfterMatch(finishedMatch, players, wallets).then((settlement) => {
              for (const pid of players) {
                const c = clientsByPlayerId.get(pid);
                if (!c) continue;
                safeSend(c.ws, {
                  type: "escrow_status",
                  playerId: pid,
                  roomId,
                  timestamp: now(),
                  payload: settlement
                });
              }
            }).catch((e) => {
              console.error("[escrow] settlement failed", e);
              for (const pid of players) {
                const c = clientsByPlayerId.get(pid);
                if (!c) continue;
                safeSend(c.ws, {
                  type: "escrow_status",
                  playerId: pid,
                  roomId,
                  timestamp: now(),
                  payload: {
                    ok: false,
                    transferredToWinner: [],
                    transferredToLoser: [],
                    failed: [{ assetId: "unknown", target: "winner", error: String(e) }]
                  }
                });
              }
            });
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
import { createUmi as createUmi2 } from "@metaplex-foundation/umi-bundle-defaults";
import { createNoopSigner, keypairIdentity as keypairIdentity2, publicKey as publicKey2, signerIdentity } from "@metaplex-foundation/umi";
import { mplBubblegum as mplBubblegum2, getAssetWithProof as getAssetWithProof2, transfer as transfer2 } from "@metaplex-foundation/mpl-bubblegum";
import { dasApi as dasApi2 } from "@metaplex-foundation/digital-asset-standard-api";
import { fromWeb3JsKeypair as fromWeb3JsKeypair2, toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";

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
var depositSessions = /* @__PURE__ */ new Map();
function sessionKey(roomId, playerId) {
  return `${roomId}:${playerId}`;
}
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
  r.post("/deposit-tx", async (req, res) => {
    if (!custodyEscrowEnabled()) {
      sendJson(res, 400, { error: "Custody escrow is not configured" });
      return;
    }
    const body = req.body;
    const { walletAddress, assetId } = body;
    if (!walletAddress || !assetId) {
      sendJson(res, 400, { error: "Invalid body" });
      return;
    }
    const custody = getCustodyPubkeyBase58();
    if (!custody) {
      sendJson(res, 500, { error: "Custody misconfigured" });
      return;
    }
    try {
      const playerPk = publicKey2(walletAddress);
      const noop = createNoopSigner(playerPk);
      const umi = createUmi2(getServerHeliusRpcUrl()).use(mplBubblegum2()).use(dasApi2()).use(signerIdentity(noop));
      const proof = await getAssetWithProof2(umi, publicKey2(assetId));
      const built = await transfer2(umi, {
        ...proof,
        leafOwner: noop,
        newLeafOwner: publicKey2(custody)
      }).buildAndSign(umi);
      const tx = toWeb3JsTransaction(built);
      const txBase64 = Buffer.from(tx.serialize()).toString("base64");
      sendJson(res, 200, { txBase64 });
    } catch (e) {
      console.error("[escrow] deposit-tx build failed", {
        assetId,
        walletAddress,
        error: e instanceof Error ? e.message : String(e)
      });
      sendJson(res, 400, { error: e instanceof Error ? e.message : "Could not build deposit transaction" });
    }
  });
  r.post("/deposit-record", (req, res) => {
    const body = req.body;
    const { roomId, playerId, walletAddress, assetId } = body;
    if (!roomId || !playerId || !walletAddress || !assetId) {
      sendJson(res, 400, { error: "Invalid body" });
      return;
    }
    const reg = getEscrowRegistrar();
    if (!reg || !reg.roomHasPlayer(roomId, playerId)) {
      sendJson(res, 400, { error: "Room not found or player not in room" });
      return;
    }
    const key = sessionKey(roomId, playerId);
    const existing = depositSessions.get(key);
    const depositedAssetIds = existing?.depositedAssetIds ?? [];
    if (!depositedAssetIds.includes(assetId)) depositedAssetIds.push(assetId);
    depositSessions.set(key, {
      roomId,
      playerId,
      walletAddress,
      depositedAssetIds,
      status: "depositing",
      updatedAt: Date.now()
    });
    sendJson(res, 200, { ok: true, depositedCount: depositedAssetIds.length });
  });
  r.post("/rollback", async (req, res) => {
    if (!custodyEscrowEnabled()) {
      sendJson(res, 400, { error: "Custody escrow is not configured" });
      return;
    }
    const body = req.body;
    const { roomId, playerId, walletAddress } = body;
    if (!roomId || !playerId || !walletAddress) {
      sendJson(res, 400, { error: "Invalid body" });
      return;
    }
    const key = sessionKey(roomId, playerId);
    const session = depositSessions.get(key);
    if (!session) {
      sendJson(res, 200, { ok: true, rolledBack: [], failed: [] });
      return;
    }
    if (session.walletAddress !== walletAddress) {
      sendJson(res, 400, { error: "Wallet mismatch for rollback session" });
      return;
    }
    const custody = getCustodyKeypair();
    if (!custody) {
      sendJson(res, 500, { error: "Custody misconfigured" });
      return;
    }
    const umi = createUmi2(getServerHeliusRpcUrl()).use(mplBubblegum2()).use(dasApi2());
    umi.use(keypairIdentity2(fromWeb3JsKeypair2(custody)));
    const rolledBack = [];
    const failed = [];
    const remaining = [];
    for (const assetId of session.depositedAssetIds) {
      try {
        const proof = await getAssetWithProof2(umi, publicKey2(assetId));
        await transfer2(umi, {
          ...proof,
          leafOwner: umi.identity,
          newLeafOwner: publicKey2(walletAddress)
        }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });
        rolledBack.push(assetId);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        failed.push({ assetId, error: message });
        remaining.push(assetId);
      }
    }
    if (remaining.length === 0) {
      depositSessions.set(key, {
        ...session,
        depositedAssetIds: [],
        status: "rolled_back",
        updatedAt: Date.now()
      });
    } else {
      depositSessions.set(key, {
        ...session,
        depositedAssetIds: remaining,
        status: "failed",
        updatedAt: Date.now()
      });
    }
    sendJson(res, 200, {
      ok: failed.length === 0,
      rolledBack,
      failed
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
    const key = sessionKey(roomId, playerId);
    const session = depositSessions.get(key);
    if (session) {
      depositSessions.set(key, {
        ...session,
        status: "confirmed",
        depositedAssetIds: [],
        updatedAt: Date.now()
      });
    }
    reg.markDepositReady(roomId, playerId, walletAddress);
    sendJson(res, 200, { ok: true });
  });
  return r;
}

// server/tokenomics-routes.ts
import express2, { Router as Router2 } from "express";

// server/db.ts
import { Pool } from "pg";
var DATABASE_URL = process.env.DATABASE_URL?.trim();
var DATABASE_SSL = process.env.DATABASE_SSL?.trim()?.toLowerCase();
var pool = null;
function isSslEnabled() {
  if (!DATABASE_SSL) return false;
  return DATABASE_SSL === "true" || DATABASE_SSL === "1" || DATABASE_SSL === "require";
}
function getPool() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: isSslEnabled() ? { rejectUnauthorized: false } : void 0,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10)
    });
  }
  return pool;
}
async function dbQuery(text, params = []) {
  const p = getPool();
  return p.query(text, params);
}
async function ensureDatabaseAvailable() {
  const p = getPool();
  await p.query("select 1");
}
function isDatabaseConfigured() {
  return !!DATABASE_URL;
}

// server/tokenomics-store.ts
var TOTAL_SUPPLY = 1e8;
var DECIMALS = 0;
var STARTER_AIRDROP = 100;
var ALLOCATIONS = {
  team: 15,
  community: 20,
  ecosystem: 15,
  platformReserve: 30,
  liquidity: 20
};
function normalizeWallet(wallet) {
  return wallet.trim();
}
function getAllocationAmount(percent) {
  return Math.floor(TOTAL_SUPPLY * percent / 100);
}
function getTokenomicsConfig() {
  return {
    tokenSymbol: "ROYALE",
    totalSupply: TOTAL_SUPPLY,
    decimals: DECIMALS,
    mintAuthorityRevoked: true,
    allocations: {
      team: getAllocationAmount(ALLOCATIONS.team),
      community: getAllocationAmount(ALLOCATIONS.community),
      ecosystem: getAllocationAmount(ALLOCATIONS.ecosystem),
      platformReserve: getAllocationAmount(ALLOCATIONS.platformReserve),
      liquidity: getAllocationAmount(ALLOCATIONS.liquidity)
    }
  };
}
async function getRoyaleBalance(wallet) {
  const key = normalizeWallet(wallet);
  const upsert = await dbQuery(
    `
    insert into token_wallets (wallet, royale_balance, challenge_tickets, starter_distributed, updated_at)
    values ($1, 0, 0, false, now())
    on conflict (wallet) do update set updated_at = now()
    returning royale_balance, starter_distributed
    `,
    [key]
  );
  const row = upsert.rows[0];
  if (!row) return 0;
  if (!row.starter_distributed) {
    const seeded = await dbQuery(
      `
      update token_wallets
      set royale_balance = royale_balance + $2,
          starter_distributed = true,
          updated_at = now()
      where wallet = $1
      returning royale_balance
      `,
      [key, STARTER_AIRDROP]
    );
    return seeded.rows[0]?.royale_balance ?? STARTER_AIRDROP;
  }
  return row.royale_balance;
}
async function distributeRoyale(wallet, amount) {
  const key = normalizeWallet(wallet);
  await getRoyaleBalance(key);
  const out = await dbQuery(
    `
    update token_wallets
    set royale_balance = royale_balance + $2,
        updated_at = now()
    where wallet = $1
    returning royale_balance
    `,
    [key, Math.max(0, Math.floor(amount))]
  );
  return { balance: out.rows[0]?.royale_balance ?? 0 };
}
async function spendRoyale(wallet, amount) {
  const key = normalizeWallet(wallet);
  const current = await getRoyaleBalance(key);
  const spend = Math.max(0, Math.floor(amount));
  if (current < spend) {
    return { ok: false, error: "Insufficient ROYALE balance" };
  }
  const out = await dbQuery(
    `
    update token_wallets
    set royale_balance = royale_balance - $2,
        updated_at = now()
    where wallet = $1
    returning royale_balance
    `,
    [key, spend]
  );
  return { ok: true, balance: out.rows[0]?.royale_balance ?? 0 };
}
async function addChallengeTickets(wallet, count) {
  const key = normalizeWallet(wallet);
  await getRoyaleBalance(key);
  const out = await dbQuery(
    `
    update token_wallets
    set challenge_tickets = challenge_tickets + $2,
        updated_at = now()
    where wallet = $1
    returning challenge_tickets
    `,
    [key, Math.max(0, Math.floor(count))]
  );
  return out.rows[0]?.challenge_tickets ?? 0;
}
async function consumeChallengeTicket(wallet) {
  const key = normalizeWallet(wallet);
  await getRoyaleBalance(key);
  const currentOut = await dbQuery(
    `select challenge_tickets from token_wallets where wallet = $1`,
    [key]
  );
  const current = currentOut.rows[0]?.challenge_tickets ?? 0;
  if (current <= 0) return { ok: false, error: "No challenge tickets left" };
  const nextOut = await dbQuery(
    `
    update token_wallets
    set challenge_tickets = challenge_tickets - 1,
        updated_at = now()
    where wallet = $1
    returning challenge_tickets
    `,
    [key]
  );
  return { ok: true, remaining: nextOut.rows[0]?.challenge_tickets ?? 0 };
}
async function getChallengeTickets(wallet) {
  const key = normalizeWallet(wallet);
  await getRoyaleBalance(key);
  const out = await dbQuery(
    `select challenge_tickets from token_wallets where wallet = $1`,
    [key]
  );
  return out.rows[0]?.challenge_tickets ?? 0;
}

// server/tokenomics-routes.ts
function createTokenomicsRouter() {
  const r = Router2();
  r.use(express2.json({ limit: "256kb" }));
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
    sendJson(res, 200, getTokenomicsConfig());
  });
  r.get("/balance/:wallet", async (req, res) => {
    const wallet = req.params.wallet;
    if (!wallet) {
      sendJson(res, 400, { error: "Missing wallet" });
      return;
    }
    sendJson(res, 200, {
      wallet,
      royaleBalance: await getRoyaleBalance(wallet),
      challengeTickets: await getChallengeTickets(wallet)
    });
  });
  r.post("/distribute", async (req, res) => {
    const body = req.body;
    if (!body.wallet || typeof body.amount !== "number" || body.amount <= 0) {
      sendJson(res, 400, { error: "wallet and positive amount are required" });
      return;
    }
    const out = await distributeRoyale(body.wallet, body.amount);
    sendJson(res, 200, { ok: true, wallet: body.wallet, royaleBalance: out.balance });
  });
  r.post("/airdrop", async (req, res) => {
    const body = req.body;
    if (!body.wallet) {
      sendJson(res, 400, { error: "wallet is required" });
      return;
    }
    const out = await distributeRoyale(body.wallet, 100);
    sendJson(res, 200, { ok: true, wallet: body.wallet, royaleBalance: out.balance, airdropped: 100 });
  });
  r.post("/tickets/purchase", async (req, res) => {
    const body = req.body;
    const wallet = body.wallet;
    const ticketCount = Math.max(1, Math.floor(body.ticketCount ?? 1));
    const royaleCostPerTicket = Math.max(1, Math.floor(body.royaleCostPerTicket ?? 5));
    if (!wallet) {
      sendJson(res, 400, { error: "wallet is required" });
      return;
    }
    const spendResult = await spendRoyale(wallet, ticketCount * royaleCostPerTicket);
    if (!spendResult.ok) {
      sendJson(res, 400, { error: spendResult.error });
      return;
    }
    const tickets = await addChallengeTickets(wallet, ticketCount);
    sendJson(res, 200, {
      ok: true,
      royaleBalance: spendResult.balance,
      challengeTickets: tickets
    });
  });
  return r;
}

// server/solo-campaign-routes.ts
import express3, { Router as Router3 } from "express";

// server/onchain-campaign.ts
import crypto from "node:crypto";
import { PublicKey } from "@solana/web3.js";
var DEFAULT_PROGRAM_ID = "11111111111111111111111111111111";
function getProgramId() {
  const raw = process.env.CAMPAIGN_PROGRAM_ID?.trim() || DEFAULT_PROGRAM_ID;
  try {
    return new PublicKey(raw);
  } catch {
    return new PublicKey(DEFAULT_PROGRAM_ID);
  }
}
function derivePda(seed, campaignId, programId) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(seed, "utf8"), Buffer.from(campaignId, "utf8")],
    programId
  );
  return pda.toBase58();
}
function isOnchainCampaignsEnabled() {
  return String(process.env.ONCHAIN_CAMPAIGNS_ENABLED || "").toLowerCase() === "true";
}
function deriveCampaignAccounts(campaignId) {
  const programId = getProgramId();
  return {
    programId: programId.toBase58(),
    campaignPda: derivePda("campaign", campaignId, programId),
    rewardVaultPda: derivePda("reward-vault", campaignId, programId),
    feeVaultPda: derivePda("fee-vault", campaignId, programId)
  };
}
function buildMemo(action, payload) {
  return JSON.stringify({
    app: "drip-royale",
    module: "campaigns",
    action,
    ts: Date.now(),
    ...payload
  });
}
function buildPublishIntent(input) {
  const accounts = deriveCampaignAccounts(input.campaignId);
  return {
    mode: "onchain",
    action: "publish_campaign",
    ...accounts,
    memo: buildMemo("publish_campaign", {
      campaignId: input.campaignId,
      creatorWallet: input.creatorWallet,
      linkedCollectionMint: input.linkedCollectionMint ?? null
    })
  };
}
function buildEntryIntent(input) {
  const accounts = deriveCampaignAccounts(input.campaignId);
  return {
    mode: "onchain",
    action: "pay_entry",
    ...accounts,
    memo: buildMemo("pay_entry", {
      campaignId: input.campaignId,
      wallet: input.wallet,
      amount: input.amount,
      entryId: input.entryId
    })
  };
}
function createRunCommitmentHash(input) {
  const nonce = Date.now();
  const digest = crypto.createHash("sha256").update(
    JSON.stringify({
      runId: input.runId,
      campaignId: input.campaignId,
      wallet: input.wallet,
      difficulty: input.difficulty,
      deckAssetIds: [...input.deckAssetIds].sort(),
      nonce
    })
  ).digest("hex");
  return { commitmentHash: digest, nonce };
}
function buildFinalizeIntent(input) {
  const accounts = deriveCampaignAccounts(input.campaignId);
  return {
    mode: "onchain",
    action: "finalize_run",
    ...accounts,
    commitmentHash: input.commitmentHash,
    nonce: input.nonce,
    memo: buildMemo("finalize_run", input)
  };
}
function buildClaimIntent(input) {
  const accounts = deriveCampaignAccounts(input.campaignId);
  return {
    mode: "onchain",
    action: "claim_reward",
    ...accounts,
    memo: buildMemo("claim_reward", input)
  };
}

// server/campaign-reward-mint.ts
import { publicKey as publicKey3 } from "@metaplex-foundation/umi";
import { createUmi as createUmi3 } from "@metaplex-foundation/umi-bundle-defaults";
import { signerIdentity as signerIdentity2, createSignerFromKeypair } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair as fromWeb3JsKeypair3 } from "@metaplex-foundation/umi-web3js-adapters";
import { mintToCollectionV1, mplBubblegum as mplBubblegum3 } from "@metaplex-foundation/mpl-bubblegum";
import bs582 from "bs58";
async function mintStageRewardCnft(input) {
  const custody = getCustodyKeypair();
  if (!custody) throw new Error("CUSTODY_PRIVATE_KEY is required for stage reward minting");
  const umi = createUmi3(getServerHeliusRpcUrl()).use(mplBubblegum3());
  const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair3(custody));
  umi.use(signerIdentity2(signer));
  const merkleTreePk = publicKey3(input.merkleTree);
  const collectionMintPk = publicKey3(input.collectionMint);
  const creatorList = input.creators && input.creators.length > 0 ? input.creators.map((c) => ({
    address: publicKey3(c.address),
    verified: Boolean(c.verified),
    share: c.share
  })) : [{ address: signer.publicKey, verified: true, share: 100 }];
  const mint = await mintToCollectionV1(umi, {
    leafOwner: publicKey3(input.recipientWallet),
    merkleTree: merkleTreePk,
    collectionMint: collectionMintPk,
    metadata: {
      name: input.rewardName,
      uri: input.metadataUri,
      sellerFeeBasisPoints: 0,
      collection: {
        key: collectionMintPk,
        verified: false
      },
      creators: creatorList
    }
  }).sendAndConfirm(umi);
  return {
    mintTx: bs582.encode(mint.signature),
    mintedAssetId: `${merkleTreePk.toString()}:${mintTxShort(bs582.encode(mint.signature))}`
  };
}
function mintTxShort(sig) {
  return sig.slice(0, 16);
}

// server/solo-campaign-routes.ts
var campaigns = [
  { id: "mvp-training", name: "MVP Training Grounds", theme: "Simulation Sandbox", creator: "DRiP System", minDeckSize: 3, rewardPool: 999, baseRoyaleReward: 8, entryTicketCost: 2, prizePreview: "Training Relic cNFT" },
  { id: "neon-citadel", name: "Neon Citadel", theme: "Cyber Landmark", creator: "DRiP Creator Alpha", minDeckSize: 5, rewardPool: 120, baseRoyaleReward: 12, entryTicketCost: 5, prizePreview: "Neon Crown (Rare cNFT)" },
  { id: "void-gallery", name: "Void Gallery", theme: "Abstract Void", creator: "DRiP Creator Sigma", minDeckSize: 5, rewardPool: 90, baseRoyaleReward: 15, entryTicketCost: 8, prizePreview: "Void Curator Key (Epic cNFT)" }
];
async function listAllCampaigns() {
  const creatorRows = await dbQuery(
    `select id, creator_wallet, name, theme, min_deck_size, reward_pool, base_royale_reward, entry_ticket_cost, prize_preview, status, config_json
     from creator_campaigns
     where status = 'published'
     order by created_at desc`
  );
  const linkedIds = creatorRows.rows.map((row) => typeof row.config_json?.linkedCollectionId === "string" ? row.config_json.linkedCollectionId : null).filter((v) => !!v);
  const collectionById = /* @__PURE__ */ new Map();
  if (linkedIds.length > 0) {
    const collections = await dbQuery(
      `select id, name, metadata_json from creator_collections where id = any($1::text[])`,
      [linkedIds]
    );
    collections.rows.forEach((row) => collectionById.set(row.id, row));
  }
  const creatorCampaigns = creatorRows.rows.map((row) => {
    const linkedCollectionId = typeof row.config_json?.linkedCollectionId === "string" ? row.config_json.linkedCollectionId : void 0;
    const linked = linkedCollectionId ? collectionById.get(linkedCollectionId) : void 0;
    const linkedCollectionMint = linked && typeof linked.metadata_json?.collectionMint === "string" ? linked.metadata_json.collectionMint : null;
    return {
      id: row.id,
      name: row.name,
      theme: row.theme,
      creator: row.creator_wallet,
      minDeckSize: row.min_deck_size,
      rewardPool: row.reward_pool,
      baseRoyaleReward: row.base_royale_reward,
      entryTicketCost: row.entry_ticket_cost,
      prizePreview: row.prize_preview || `${row.reward_pool} cNFT pool`,
      linkedCollectionId,
      linkedCollectionName: linked?.name,
      linkedCollectionMint
    };
  });
  return [...campaigns, ...creatorCampaigns];
}
var STAGES = ["Match 1", "Match 2", "Match 3", "Boss"];
var ENTRY_SPLIT = { creator: 50, rewardPool: 35, protocol: 15 };
function difficultyScale(difficulty) {
  if (difficulty === "hard") return 1.2;
  if (difficulty === "nightmare") return 1.45;
  return 1;
}
function difficultyRank(difficulty) {
  if (difficulty === "nightmare") return 3;
  if (difficulty === "hard") return 2;
  if (difficulty === "normal") return 1;
  return 0;
}
function stageScale(stageIndex, difficulty) {
  const stageBase = [0.95, 1.05, 1.15, 1.3][Math.max(0, Math.min(3, stageIndex))] ?? 1;
  return stageBase * difficultyScale(difficulty);
}
function randomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}
function difficultyPowerBand(difficulty, stageIndex) {
  if (difficulty === "nightmare") {
    if (stageIndex >= 3) return { min: 10, max: 10, boostChance: 1 };
    if (stageIndex >= 2) return { min: 9, max: 10, boostChance: 0.95 };
    return { min: 9, max: 10, boostChance: 0.85 };
  }
  if (difficulty === "hard") {
    if (stageIndex >= 3) return { min: 8, max: 10, boostChance: 0.8 };
    if (stageIndex >= 2) return { min: 7, max: 10, boostChance: 0.68 };
    return { min: 6, max: 9, boostChance: 0.5 };
  }
  if (stageIndex >= 3) return { min: 7, max: 10, boostChance: 0.52 };
  if (stageIndex >= 2) return { min: 6, max: 9, boostChance: 0.38 };
  return { min: 5, max: 8, boostChance: 0.24 };
}
function opponentDeckFromPlayer(deck, difficulty, stageIndex) {
  const scale = stageScale(stageIndex, difficulty);
  const shuffled = [...deck].sort(() => Math.random() - 0.5);
  const band = difficultyPowerBand(difficulty, stageIndex);
  return deck.map((card, idx) => {
    const source = shuffled[idx % shuffled.length] ?? card;
    const scaled = Math.round(source.power * scale) + (stageIndex >= 2 ? 1 : 0);
    const randomBandPower = randomInt(band.min, band.max);
    const boosted = Math.random() < band.boostChance ? Math.max(scaled, randomBandPower) : Math.round((scaled + randomBandPower) / 2);
    const floorByDifficulty = difficulty === "nightmare" ? stageIndex >= 2 ? 9 : 8 : difficulty === "hard" ? 6 : 4;
    const power = Math.max(2, Math.min(10, Math.max(floorByDifficulty, boosted)));
    return {
      assetId: `stage-${stageIndex}-${idx}-${source.assetId}`,
      imageUri: source.imageUri,
      name: `${STAGES[stageIndex]} ${source.name ?? "Card"}`,
      power
    };
  });
}
function pickHighest(deck) {
  if (deck.length === 0) return null;
  return [...deck].sort((a, b) => b.power - a.power)[0] ?? null;
}
function splitEntry(amount) {
  const creator = Math.floor(amount * ENTRY_SPLIT.creator / 100);
  const rewardPool = Math.floor(amount * ENTRY_SPLIT.rewardPool / 100);
  const protocol = Math.max(0, amount - creator - rewardPool);
  return { creator, rewardPool, protocol };
}
function initializeStageMatch(run) {
  const opponentDeck = opponentDeckFromPlayer(run.deck, run.difficulty, run.stageIndex);
  return initializeLocalMatch(run.deck, opponentDeck, "You", STAGES[run.stageIndex] ?? "Boss");
}
function resolveAIPicks(match) {
  let next = match;
  while (next.isActive && next.pickTurn === "player2") {
    const aiPick = pickHighest(next.player2.deck);
    if (!aiPick) break;
    next = submitPick(next, "player2", aiPick.assetId);
  }
  return next;
}
async function upsertProgress(wallet, campaignId, progress) {
  await dbQuery(
    `
    insert into campaign_progress (wallet, campaign_id, completed_chapters, wins, losses, best_difficulty, claimed_rewards, updated_at)
    values ($1,$2,$3,$4,$5,$6,$7,now())
    on conflict (wallet, campaign_id)
    do update set completed_chapters=$3, wins=$4, losses=$5, best_difficulty=$6, claimed_rewards=$7, updated_at=now()
    `,
    [wallet, campaignId, progress.completedChapters, progress.wins, progress.losses, progress.bestDifficulty, progress.claimedRewards]
  );
}
async function getProgress(wallet, campaignId) {
  const out = await dbQuery(`select * from campaign_progress where wallet=$1 and campaign_id=$2`, [wallet, campaignId]);
  const row = out.rows[0];
  if (!row) {
    return { completedChapters: 0, wins: 0, losses: 0, bestDifficulty: null, claimedRewards: 0 };
  }
  return {
    completedChapters: row.completed_chapters,
    wins: row.wins,
    losses: row.losses,
    bestDifficulty: row.best_difficulty,
    claimedRewards: row.claimed_rewards
  };
}
async function saveRun(run) {
  await dbQuery(
    `
    insert into campaign_runs (run_id, wallet, campaign_id, difficulty, stage_index, status, prompt, all_flawless, reward_granted, royale_reward, deck_json, match_json, updated_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,now())
    on conflict (run_id)
    do update set stage_index=$5,status=$6,prompt=$7,all_flawless=$8,reward_granted=$9,royale_reward=$10,deck_json=$11::jsonb,match_json=$12::jsonb,updated_at=now()
    `,
    [
      run.runId,
      run.wallet,
      run.campaignId,
      run.difficulty,
      run.stageIndex,
      run.status,
      run.prompt,
      run.allFlawless,
      run.rewardGranted,
      run.royaleReward,
      JSON.stringify(run.deck),
      JSON.stringify(run.match)
    ]
  );
}
async function getRun(runId) {
  const out = await dbQuery(`select * from campaign_runs where run_id=$1`, [runId]);
  const row = out.rows[0];
  if (!row) return null;
  return {
    runId: row.run_id,
    wallet: row.wallet,
    campaignId: row.campaign_id,
    difficulty: row.difficulty,
    stageIndex: row.stage_index,
    status: row.status,
    prompt: row.prompt,
    allFlawless: row.all_flawless,
    rewardGranted: row.reward_granted,
    royaleReward: row.royale_reward,
    deck: row.deck_json ?? [],
    match: row.match_json ?? null
  };
}
async function removeRun(runId) {
  await dbQuery(`delete from campaign_runs where run_id=$1`, [runId]);
}
async function getRunChainState(runId) {
  const out = await dbQuery(
    `select run_id, commitment_hash, nonce::text, status, finalize_signature, claim_signature
     from campaign_run_chain where run_id = $1`,
    [runId]
  );
  return out.rows[0] ?? null;
}
async function getCampaignChainState(campaignId) {
  const out = await dbQuery(
    `select campaign_id, chain_mode, program_id, campaign_pda, reward_vault_pda, fee_vault_pda, publish_signature, status
     from campaign_chain_state where campaign_id = $1`,
    [campaignId]
  );
  return out.rows[0] ?? null;
}
async function runResponse(run, campaign) {
  const chainRun = await getRunChainState(run.runId);
  const chainCampaign = await getCampaignChainState(campaign.id);
  const rewardsOut = await dbQuery(
    `
    select stage_index, reward_name, metadata_uri, mint_tx, minted_asset_id, created_at
    from campaign_run_rewards
    where run_id = $1
    order by stage_index asc
    `,
    [run.runId]
  );
  return {
    ok: true,
    runId: run.runId,
    campaign: { id: campaign.id, name: campaign.name, rewardPool: campaign.rewardPool },
    status: run.status,
    stageIndex: run.stageIndex,
    stageLabel: STAGES[run.stageIndex] ?? STAGES[3],
    match: run.match,
    prompt: run.prompt,
    royaleReward: run.royaleReward,
    rewardGranted: run.rewardGranted,
    royaleBalance: await getRoyaleBalance(run.wallet),
    challengeTickets: await getChallengeTickets(run.wallet),
    onchain: {
      enabled: isOnchainCampaignsEnabled(),
      chainMode: chainCampaign?.chain_mode ?? "offchain",
      campaignStatus: chainCampaign?.status ?? "draft",
      runStatus: chainRun?.status ?? null,
      finalizedSignature: chainRun?.finalize_signature ?? null,
      claimSignature: chainRun?.claim_signature ?? null
    },
    mintedRewards: rewardsOut.rows.map((r) => ({
      stageIndex: r.stage_index,
      rewardName: r.reward_name,
      metadataUri: r.metadata_uri,
      mintTx: r.mint_tx,
      mintedAssetId: r.minted_asset_id,
      createdAt: r.created_at
    }))
  };
}
async function updateProgressOnStageResult(run, campaign) {
  if (!run.match || run.match.isActive) return;
  const progress = await getProgress(run.wallet, campaign.id);
  const stageFlawless = run.match.roundResults.every((r) => r.winner !== "player2");
  run.allFlawless = run.allFlawless && stageFlawless;
  if (run.match.winner === "player1") {
    await mintStageRewardForStageWin(run, campaign, run.stageIndex);
    progress.completedChapters += 1;
    if (run.stageIndex >= 3) {
      progress.wins += 1;
      progress.bestDifficulty = difficultyRank(run.difficulty) > difficultyRank(progress.bestDifficulty) ? run.difficulty : progress.bestDifficulty;
      const base = Math.floor(campaign.baseRoyaleReward * difficultyScale(run.difficulty));
      run.royaleReward = run.allFlawless ? base + 3 : base;
      await distributeRoyale(run.wallet, run.royaleReward);
      run.rewardGranted = campaign.rewardPool > 0;
      if (run.rewardGranted) progress.claimedRewards += 1;
      if (run.allFlawless) await addChallengeTickets(run.wallet, 1);
      run.status = "completed";
      run.prompt = "Boss defeated. Campaign cleared.";
    } else {
      run.status = "stage_won";
      run.prompt = `${STAGES[run.stageIndex]} cleared. Continue to next match.`;
    }
  } else {
    progress.losses += 1;
    run.status = "lost";
    run.prompt = `Defeated at ${STAGES[run.stageIndex]}. Return to campaign page.`;
  }
  await upsertProgress(run.wallet, campaign.id, progress);
}
async function mintStageRewardForStageWin(run, campaign, stageIndex) {
  if (!campaign.id.startsWith("creator-")) return;
  const existing = await dbQuery(
    `select id from campaign_run_rewards where run_id = $1 and stage_index = $2`,
    [run.runId, stageIndex]
  );
  if (existing.rows[0]) return;
  const stageCfg = await dbQuery(
    `
    select reward_name, metadata_uri, status
    from campaign_stage_rewards
    where campaign_id = $1 and stage_index = $2
    `,
    [campaign.id, stageIndex]
  );
  const reward = stageCfg.rows[0];
  if (!reward || reward.status !== "active") return;
  const collection = await dbQuery(
    `
    select cc.metadata_json
    from creator_campaigns cp
    join creator_collections cc on cc.id = (cp.config_json->>'linkedCollectionId')
    where cp.id = $1
    `,
    [campaign.id]
  );
  const metadataJson = collection.rows[0]?.metadata_json;
  const collectionMint = metadataJson && typeof metadataJson.collectionMint === "string" ? metadataJson.collectionMint : null;
  const merkleTree = metadataJson && typeof metadataJson.merkleTree === "string" ? metadataJson.merkleTree : null;
  if (!collectionMint || !merkleTree) {
    console.warn(`[campaign] missing collectionMint/merkleTree for campaign ${campaign.id}, skipping stage mint`);
    return;
  }
  try {
    const minted = await mintStageRewardCnft({
      recipientWallet: run.wallet,
      collectionMint,
      merkleTree,
      rewardName: reward.reward_name,
      metadataUri: reward.metadata_uri,
      creators: [{ address: campaign.creator, verified: false, share: 100 }]
    });
    await dbQuery(
      `
      insert into campaign_run_rewards (
        run_id, campaign_id, wallet, stage_index, reward_name, metadata_uri, mint_tx, minted_asset_id, created_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,now())
      on conflict (run_id, stage_index) do nothing
      `,
      [run.runId, campaign.id, run.wallet, stageIndex, reward.reward_name, reward.metadata_uri, minted.mintTx, minted.mintedAssetId]
    );
  } catch (e) {
    console.error(`[campaign] stage reward mint failed for run ${run.runId} stage ${stageIndex}`, e);
  }
}
function createSoloCampaignRouter() {
  const r = Router3();
  r.use(express3.json({ limit: "512kb" }));
  const sendJson = (res, status, payload) => {
    if (typeof res?.status === "function" && typeof res?.json === "function") return res.status(status).json(payload);
    if (typeof res?.writeHead === "function") {
      res.writeHead(status, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(payload));
    }
    res.statusCode = status;
    if (typeof res?.setHeader === "function") res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(payload));
  };
  r.get("/", async (_req, res) => {
    const allCampaigns = await listAllCampaigns();
    return sendJson(res, 200, { campaigns: allCampaigns });
  });
  r.get("/creators/:creator/earnings", async (req, res) => {
    const creator = decodeURIComponent(req.params.creator || "").trim();
    if (!creator) return sendJson(res, 400, { error: "creator is required" });
    const out = await dbQuery(
      `select total_royale, by_campaign from creator_earnings where creator = $1`,
      [creator]
    );
    const row = out.rows[0] ?? { total_royale: 0, by_campaign: {} };
    return sendJson(res, 200, { creator, totalRoyale: row.total_royale, byCampaign: row.by_campaign });
  });
  r.get("/progress/:wallet", async (req, res) => {
    const wallet = req.params.wallet;
    const rows = await dbQuery(`select * from campaign_progress where wallet = $1`, [wallet]);
    const byCampaign = new Map(rows.rows.map((r2) => [r2.campaign_id, r2]));
    const allCampaigns = await listAllCampaigns();
    const progress = allCampaigns.map((campaign) => {
      const row = byCampaign.get(campaign.id);
      return {
        campaignId: campaign.id,
        completedChapters: row?.completed_chapters ?? 0,
        wins: row?.wins ?? 0,
        losses: row?.losses ?? 0,
        bestDifficulty: row?.best_difficulty ?? null,
        claimedRewards: row?.claimed_rewards ?? 0
      };
    });
    return sendJson(res, 200, {
      wallet,
      progress,
      royaleBalance: await getRoyaleBalance(wallet),
      challengeTickets: await getChallengeTickets(wallet)
    });
  });
  r.post("/:campaignId/deposit", async (req, res) => {
    const allCampaigns = await listAllCampaigns();
    const campaign = allCampaigns.find((c) => c.id === req.params.campaignId);
    if (!campaign) return sendJson(res, 404, { error: "Campaign not found" });
    const rewardCount = Math.max(1, Math.floor(req.body.rewardCount ?? 1));
    if (campaign.id.startsWith("creator-")) {
      const out = await dbQuery(
        `update creator_campaigns set reward_pool = reward_pool + $2, updated_at = now() where id = $1 returning reward_pool`,
        [campaign.id, rewardCount]
      );
      return sendJson(res, 200, { ok: true, campaignId: campaign.id, rewardPool: out.rows[0]?.reward_pool ?? campaign.rewardPool });
    }
    campaign.rewardPool += rewardCount;
    return sendJson(res, 200, { ok: true, campaignId: campaign.id, rewardPool: campaign.rewardPool });
  });
  r.post("/:campaignId/entry/preview", async (req, res) => {
    const allCampaigns = await listAllCampaigns();
    const campaign = allCampaigns.find((c) => c.id === req.params.campaignId);
    if (!campaign) return sendJson(res, 404, { error: "Campaign not found" });
    const amount = Math.max(0, Math.floor(campaign.entryTicketCost));
    const split = splitEntry(amount);
    const wallet = req.body?.walletAddress?.trim();
    const balance = wallet ? await getRoyaleBalance(wallet) : void 0;
    return sendJson(res, 200, {
      campaignId: campaign.id,
      amount,
      split,
      splitPct: ENTRY_SPLIT,
      royaleBalance: balance,
      canAfford: wallet ? (balance ?? 0) >= amount : void 0
    });
  });
  r.post("/:campaignId/entry/commit", async (req, res) => {
    const allCampaigns = await listAllCampaigns();
    const campaign = allCampaigns.find((c) => c.id === req.params.campaignId);
    if (!campaign) return sendJson(res, 404, { error: "Campaign not found" });
    const wallet = req.body.walletAddress?.trim();
    if (!wallet) return sendJson(res, 400, { error: "walletAddress is required" });
    const amount = Math.max(0, Math.floor(campaign.entryTicketCost));
    const split = splitEntry(amount);
    if (amount > 0) {
      const spent = await spendRoyale(wallet, amount);
      if (!spent.ok) return sendJson(res, 400, { error: spent.error });
    }
    await dbQuery(
      `
      insert into creator_earnings (creator, total_royale, by_campaign, updated_at)
      values ($1, $2::int, jsonb_build_object($3::text, $2::int), now())
      on conflict (creator)
      do update set total_royale = creator_earnings.total_royale + $2,
                   by_campaign = creator_earnings.by_campaign || jsonb_build_object($3::text, coalesce((creator_earnings.by_campaign->>($3::text))::int, 0) + $2::int),
                   updated_at = now()
      `,
      [campaign.creator, split.creator, campaign.id]
    );
    await dbQuery(
      `
      insert into campaign_funds (campaign_id, reward_pool_royale, protocol_royale, updated_at)
      values ($1,$2,$3,now())
      on conflict (campaign_id)
      do update set reward_pool_royale = campaign_funds.reward_pool_royale + $2,
                   protocol_royale = campaign_funds.protocol_royale + $3,
                   updated_at = now()
      `,
      [campaign.id, split.rewardPool, split.protocol]
    );
    const entryId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await dbQuery(
      `insert into campaign_entries (entry_id,wallet,campaign_id,amount,split_json,status,created_at) values ($1,$2,$3,$4,$5::jsonb,'committed',now())`,
      [entryId, wallet, campaign.id, amount, JSON.stringify(split)]
    );
    const chainIntent = isOnchainCampaignsEnabled() && campaign.id.startsWith("creator-") ? buildEntryIntent({
      campaignId: campaign.id,
      wallet,
      amount,
      entryId
    }) : null;
    return sendJson(res, 200, {
      ok: true,
      entryId,
      campaignId: campaign.id,
      amount,
      split,
      royaleBalance: await getRoyaleBalance(wallet),
      challengeTickets: await getChallengeTickets(wallet),
      onchain: chainIntent
    });
  });
  r.post("/:campaignId/runs/start", async (req, res) => {
    const allCampaigns = await listAllCampaigns();
    const campaign = allCampaigns.find((c) => c.id === req.params.campaignId);
    if (!campaign) return sendJson(res, 404, { error: "Campaign not found" });
    const body = req.body;
    const wallet = body.walletAddress?.trim();
    if (!wallet) return sendJson(res, 400, { error: "walletAddress is required" });
    const deck = Array.isArray(body.deck) ? body.deck : [];
    if (deck.length < campaign.minDeckSize) return sendJson(res, 400, { error: `Minimum deck size is ${campaign.minDeckSize}` });
    const difficulty = body.difficulty === "hard" || body.difficulty === "nightmare" ? body.difficulty : "normal";
    const entryCost = Math.max(0, Math.floor(campaign.entryTicketCost));
    if (entryCost > 0) {
      const entryId = body.entryId?.trim();
      if (!entryId) return sendJson(res, 400, { error: "entryId is required for this campaign" });
      const entry = await dbQuery(`select wallet, campaign_id, status from campaign_entries where entry_id=$1`, [entryId]);
      const row = entry.rows[0];
      if (!row) return sendJson(res, 400, { error: "Invalid entryId" });
      if (row.status !== "committed") return sendJson(res, 400, { error: "Entry already consumed" });
      if (row.wallet !== wallet || row.campaign_id !== campaign.id) return sendJson(res, 403, { error: "entryId does not belong to this wallet/campaign" });
      await dbQuery(`update campaign_entries set status='consumed' where entry_id=$1`, [entryId]);
    }
    if (body.useTicket) {
      const spent = await consumeChallengeTicket(wallet);
      if (!spent.ok) return sendJson(res, 400, { error: spent.error });
    }
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const run = {
      runId,
      wallet,
      campaignId: campaign.id,
      difficulty,
      deck: deck.map((c) => ({ ...c })),
      stageIndex: 0,
      status: "in_progress",
      match: null,
      prompt: null,
      allFlawless: true,
      rewardGranted: false,
      royaleReward: 0
    };
    run.match = resolveAIPicks(initializeStageMatch(run));
    await saveRun(run);
    if (isOnchainCampaignsEnabled() && campaign.id.startsWith("creator-")) {
      const { commitmentHash, nonce } = createRunCommitmentHash({
        runId,
        campaignId: campaign.id,
        wallet,
        difficulty,
        deckAssetIds: run.deck.map((d) => d.assetId)
      });
      await dbQuery(
        `
        insert into campaign_run_chain (run_id, wallet, campaign_id, commitment_hash, nonce, status, updated_at)
        values ($1,$2,$3,$4,$5,'committed',now())
        on conflict (run_id)
        do update set commitment_hash=$4, nonce=$5, status='committed', updated_at=now()
        `,
        [runId, wallet, campaign.id, commitmentHash, nonce]
      );
    }
    if (body.entryId) await dbQuery(`update campaign_entries set run_id=$2 where entry_id=$1`, [body.entryId, runId]);
    return sendJson(res, 200, await runResponse(run, campaign));
  });
  r.post("/:campaignId/onchain/publish-intent", async (req, res) => {
    const allCampaigns = await listAllCampaigns();
    const campaign = allCampaigns.find((c) => c.id === req.params.campaignId);
    if (!campaign) return sendJson(res, 404, { error: "Campaign not found" });
    const creatorWallet = req.body?.creatorWallet?.trim();
    if (!creatorWallet) return sendJson(res, 400, { error: "creatorWallet is required" });
    const intent = buildPublishIntent({
      campaignId: campaign.id,
      creatorWallet,
      linkedCollectionMint: campaign.linkedCollectionMint ?? null
    });
    await dbQuery(
      `
      insert into campaign_chain_state (
        campaign_id, chain_mode, program_id, campaign_pda, reward_vault_pda, fee_vault_pda, status, updated_at
      )
      values ($1,'onchain',$2,$3,$4,$5,'published',now())
      on conflict (campaign_id)
      do update set chain_mode='onchain', program_id=$2, campaign_pda=$3, reward_vault_pda=$4, fee_vault_pda=$5, status='published', updated_at=now()
      `,
      [campaign.id, intent.programId, intent.campaignPda, intent.rewardVaultPda, intent.feeVaultPda]
    );
    return sendJson(res, 200, { ok: true, intent });
  });
  r.post("/:campaignId/onchain/publish-confirm", async (req, res) => {
    const campaignId = req.params.campaignId;
    const body = req.body;
    if (!body.creatorWallet?.trim() || !body.signature?.trim()) {
      return sendJson(res, 400, { error: "creatorWallet and signature are required" });
    }
    await dbQuery(
      `
      update campaign_chain_state
      set publish_signature = $2, status = 'published', updated_at = now()
      where campaign_id = $1
      `,
      [campaignId, body.signature.trim()]
    );
    return sendJson(res, 200, { ok: true, status: "published", signature: body.signature.trim() });
  });
  r.post("/entries/:entryId/onchain/confirm", async (req, res) => {
    const entryId = req.params.entryId;
    const body = req.body;
    if (!body.walletAddress?.trim() || !body.signature?.trim()) {
      return sendJson(res, 400, { error: "walletAddress and signature are required" });
    }
    const entry = await dbQuery(
      `select wallet, campaign_id from campaign_entries where entry_id = $1`,
      [entryId]
    );
    const row = entry.rows[0];
    if (!row) return sendJson(res, 404, { error: "Entry not found" });
    if (row.wallet !== body.walletAddress.trim()) return sendJson(res, 403, { error: "wallet mismatch" });
    await dbQuery(
      `
      insert into campaign_entry_chain (entry_id, wallet, campaign_id, status, pay_signature, updated_at)
      values ($1,$2,$3,'paid',$4,now())
      on conflict (entry_id)
      do update set status='paid', pay_signature=$4, updated_at=now()
      `,
      [entryId, row.wallet, row.campaign_id, body.signature.trim()]
    );
    return sendJson(res, 200, { ok: true, status: "paid", signature: body.signature.trim() });
  });
  r.post("/runs/:runId/onchain/finalize-intent", async (req, res) => {
    const run = await getRun(req.params.runId);
    if (!run) return sendJson(res, 404, { error: "Run not found" });
    const allCampaigns = await listAllCampaigns();
    const campaign = allCampaigns.find((c) => c.id === run.campaignId);
    if (!campaign) return sendJson(res, 404, { error: "Campaign not found" });
    const body = req.body;
    if (!body.walletAddress || body.walletAddress !== run.wallet) return sendJson(res, 403, { error: "wallet mismatch" });
    const chain = await getRunChainState(run.runId);
    if (!chain) return sendJson(res, 400, { error: "Run commitment missing. Start run again." });
    const intent = buildFinalizeIntent({
      campaignId: campaign.id,
      runId: run.runId,
      wallet: run.wallet,
      commitmentHash: chain.commitment_hash,
      nonce: Number(chain.nonce)
    });
    await dbQuery(
      `update campaign_run_chain set status='finalize_pending', finalize_signature=coalesce($2, finalize_signature), updated_at=now() where run_id=$1`,
      [run.runId, body.chainSignature?.trim() || null]
    );
    return sendJson(res, 200, { ok: true, intent });
  });
  r.post("/runs/:runId/onchain/claim-intent", async (req, res) => {
    const run = await getRun(req.params.runId);
    if (!run) return sendJson(res, 404, { error: "Run not found" });
    const allCampaigns = await listAllCampaigns();
    const campaign = allCampaigns.find((c) => c.id === run.campaignId);
    if (!campaign) return sendJson(res, 404, { error: "Campaign not found" });
    const body = req.body;
    if (!body.walletAddress || body.walletAddress !== run.wallet) return sendJson(res, 403, { error: "wallet mismatch" });
    if (run.status !== "completed") return sendJson(res, 400, { error: "Run not completed" });
    const intent = buildClaimIntent({
      campaignId: campaign.id,
      runId: run.runId,
      wallet: run.wallet,
      rewardType: campaign.linkedCollectionMint ? "hybrid" : "royale"
    });
    await dbQuery(
      `update campaign_run_chain set status='claim_pending', claim_signature=coalesce($2, claim_signature), updated_at=now() where run_id=$1`,
      [run.runId, body.chainSignature?.trim() || null]
    );
    return sendJson(res, 200, { ok: true, intent });
  });
  r.post("/runs/:runId/onchain/confirm", async (req, res) => {
    const run = await getRun(req.params.runId);
    if (!run) return sendJson(res, 404, { error: "Run not found" });
    const body = req.body;
    if (!body.walletAddress || body.walletAddress !== run.wallet) return sendJson(res, 403, { error: "wallet mismatch" });
    if (!body.stage || !body.signature?.trim()) return sendJson(res, 400, { error: "stage and signature are required" });
    if (body.stage === "finalize") {
      await dbQuery(
        `update campaign_run_chain set status='finalized', finalize_signature=$2, updated_at=now() where run_id=$1`,
        [run.runId, body.signature.trim()]
      );
      return sendJson(res, 200, { ok: true, status: "finalized" });
    }
    await dbQuery(
      `update campaign_run_chain set status='claimed', claim_signature=$2, updated_at=now() where run_id=$1`,
      [run.runId, body.signature.trim()]
    );
    return sendJson(res, 200, { ok: true, status: "claimed" });
  });
  r.get("/runs/:runId", async (req, res) => {
    const run = await getRun(req.params.runId);
    if (!run) return sendJson(res, 404, { error: "Run not found" });
    const allCampaigns = await listAllCampaigns();
    const campaign = allCampaigns.find((c) => c.id === run.campaignId);
    if (!campaign) return sendJson(res, 404, { error: "Campaign not found" });
    return sendJson(res, 200, await runResponse(run, campaign));
  });
  r.post("/runs/:runId/pick", async (req, res) => {
    const run = await getRun(req.params.runId);
    if (!run) return sendJson(res, 404, { error: "Run not found" });
    const allCampaigns = await listAllCampaigns();
    const campaign = allCampaigns.find((c) => c.id === run.campaignId);
    if (!campaign) return sendJson(res, 404, { error: "Campaign not found" });
    const body = req.body;
    if (!body.walletAddress || body.walletAddress !== run.wallet) return sendJson(res, 403, { error: "wallet mismatch" });
    if (!body.assetId) return sendJson(res, 400, { error: "assetId is required" });
    if (run.status !== "in_progress" || !run.match) return sendJson(res, 400, { error: "Run is not in an active match state" });
    let next = submitPick(run.match, "player1", body.assetId);
    next = resolveAIPicks(next);
    run.match = next;
    if (!run.match.isActive) await updateProgressOnStageResult(run, campaign);
    await saveRun(run);
    return sendJson(res, 200, await runResponse(run, campaign));
  });
  r.post("/runs/:runId/next", async (req, res) => {
    const run = await getRun(req.params.runId);
    if (!run) return sendJson(res, 404, { error: "Run not found" });
    const allCampaigns = await listAllCampaigns();
    const campaign = allCampaigns.find((c) => c.id === run.campaignId);
    if (!campaign) return sendJson(res, 404, { error: "Campaign not found" });
    const body = req.body;
    if (!body.walletAddress || body.walletAddress !== run.wallet) return sendJson(res, 403, { error: "wallet mismatch" });
    if (run.status !== "stage_won") return sendJson(res, 400, { error: "Next stage unavailable for current run state" });
    run.stageIndex = Math.min(3, run.stageIndex + 1);
    run.status = "in_progress";
    run.prompt = null;
    run.match = resolveAIPicks(initializeStageMatch(run));
    await saveRun(run);
    return sendJson(res, 200, await runResponse(run, campaign));
  });
  r.post("/runs/:runId/exit", async (req, res) => {
    const run = await getRun(req.params.runId);
    if (!run) return sendJson(res, 404, { error: "Run not found" });
    const body = req.body;
    if (!body.walletAddress || body.walletAddress !== run.wallet) return sendJson(res, 403, { error: "wallet mismatch" });
    await removeRun(run.runId);
    return sendJson(res, 200, { ok: true });
  });
  return r;
}

// server/users-routes.ts
import express4, { Router as Router4 } from "express";
import { nanoid as nanoid2 } from "nanoid";

// server/campaign-collection-bootstrap.ts
import { createUmi as createUmi4 } from "@metaplex-foundation/umi-bundle-defaults";
import { createNft, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { createTree, mplBubblegum as mplBubblegum4 } from "@metaplex-foundation/mpl-bubblegum";
import { generateSigner, signerIdentity as signerIdentity3, percentAmount, createSignerFromKeypair as createSignerFromKeypair2 } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair as fromWeb3JsKeypair4 } from "@metaplex-foundation/umi-web3js-adapters";
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs583 from "bs58";
async function bootstrapCollectionNft(input) {
  const custody = getCustodyKeypair();
  if (!custody) throw new Error("CUSTODY_PRIVATE_KEY is required to create collection");
  const umi = createUmi4(getServerHeliusRpcUrl()).use(mplTokenMetadata());
  const signer = createSignerFromKeypair2(umi, fromWeb3JsKeypair4(custody));
  umi.use(signerIdentity3(signer));
  await ensureSignerCanPay(custody.publicKey.toBase58(), getServerHeliusRpcUrl());
  const collectionMint = generateSigner(umi);
  const tx = await createNft(umi, {
    mint: collectionMint,
    symbol: input.symbol?.trim() || "DRIP",
    name: input.name.trim(),
    uri: input.metadataUri.trim(),
    sellerFeeBasisPoints: percentAmount(Math.max(0, Math.min(10, input.sellerFeePercent ?? 0))),
    isCollection: true
  }).sendAndConfirm(umi);
  return {
    collectionMint: collectionMint.publicKey.toString(),
    txSignature: bs583.encode(tx.signature)
  };
}
async function bootstrapMerkleTree(input) {
  const custody = getCustodyKeypair();
  if (!custody) throw new Error("CUSTODY_PRIVATE_KEY is required to create merkle tree");
  const umi = createUmi4(getServerHeliusRpcUrl()).use(mplBubblegum4());
  const signer = createSignerFromKeypair2(umi, fromWeb3JsKeypair4(custody));
  umi.use(signerIdentity3(signer));
  await ensureSignerCanPay(custody.publicKey.toBase58(), getServerHeliusRpcUrl());
  const merkleTree = generateSigner(umi);
  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: input?.maxDepth ?? 14,
    maxBufferSize: input?.maxBufferSize ?? 64
  });
  const tx = await builder.sendAndConfirm(umi);
  return {
    merkleTree: merkleTree.publicKey.toString(),
    txSignature: bs583.encode(tx.signature)
  };
}
async function ensureSignerCanPay(wallet, rpcUrl) {
  const conn = new Connection(rpcUrl, "confirmed");
  const lamports = await conn.getBalance(new (await import("@solana/web3.js")).PublicKey(wallet), "confirmed");
  if (lamports > 1e-3 * LAMPORTS_PER_SOL) return;
  const network = String(
    process.env.SOLANA_NETWORK || process.env.NEXT_PUBLIC_SOLANA_NETWORK || process.env.VITE_SOLANA_NETWORK || "devnet"
  ).toLowerCase();
  if (network === "devnet") {
    try {
      const sig = await conn.requestAirdrop(
        new (await import("@solana/web3.js")).PublicKey(wallet),
        0.05 * LAMPORTS_PER_SOL
      );
      await conn.confirmTransaction(sig, "confirmed");
      const after = await conn.getBalance(new (await import("@solana/web3.js")).PublicKey(wallet), "confirmed");
      if (after > 0) return;
    } catch {
    }
  }
  throw new Error(
    `[campaign-bootstrap] Signer wallet ${wallet} has insufficient SOL for fees on ${network}. Fund this wallet and retry.`
  );
}

// server/users-routes.ts
function normalizeWallet2(wallet) {
  return (wallet ?? "").trim();
}
function readQueryLimit(req, fallback) {
  const expressLimit = req?.query?.limit;
  if (expressLimit !== void 0) {
    const parsed = Number(expressLimit);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  const rawUrl = typeof req?.url === "string" ? req.url : "";
  if (!rawUrl) return fallback;
  try {
    const url = new URL(rawUrl, "http://localhost");
    const fromUrl = Number(url.searchParams.get("limit") ?? fallback);
    return Number.isFinite(fromUrl) ? fromUrl : fallback;
  } catch {
    return fallback;
  }
}
function createUsersRouter() {
  const r = Router4();
  r.use(express4.json({ limit: "256kb" }));
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
  r.get("/:wallet", async (req, res) => {
    const wallet = normalizeWallet2(req.params.wallet);
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    const out = await dbQuery(
      `select wallet, role, username from users where wallet = $1`,
      [wallet]
    );
    const row = out.rows[0] ?? null;
    return sendJson(res, 200, {
      wallet,
      role: row?.role ?? null,
      username: row?.username ?? null,
      isNew: !row
    });
  });
  r.post("/:wallet/role", async (req, res) => {
    const wallet = normalizeWallet2(req.params.wallet);
    const body = req.body;
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    if (body.role !== "player" && body.role !== "creator") {
      return sendJson(res, 400, { error: "role must be player or creator" });
    }
    const username = body.username?.trim() || null;
    const out = await dbQuery(
      `
      insert into users (wallet, role, username, created_at, updated_at)
      values ($1, $2, $3, now(), now())
      on conflict (wallet)
      do update set role = excluded.role,
                    username = coalesce(excluded.username, users.username),
                    updated_at = now()
      returning wallet, role, username
      `,
      [wallet, body.role, username]
    );
    return sendJson(res, 200, { ok: true, ...out.rows[0] });
  });
  r.get("/:wallet/history", async (req, res) => {
    const wallet = normalizeWallet2(req.params.wallet);
    const limitRaw = readQueryLimit(req, 50);
    const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    const out = await dbQuery(
      `
      select id, external_match_id, opponent, result, reward, nfts_won, mode, created_at
      from match_history
      where wallet = $1
      order by created_at desc
      limit $2
      `,
      [wallet, limit]
    );
    const entries = out.rows.map((row) => ({
      id: `match-${row.id}`,
      externalMatchId: row.external_match_id,
      opponent: row.opponent,
      result: row.result,
      reward: row.reward,
      nftsWon: row.nfts_won ?? [],
      mode: row.mode,
      date: new Date(row.created_at).toLocaleString(),
      createdAt: row.created_at
    }));
    const wins = entries.filter((e) => e.result === "WIN").length;
    const losses = entries.filter((e) => e.result === "LOSS").length;
    const total = wins + losses;
    const winRate = total > 0 ? Number((wins / total * 100).toFixed(1)) : 0;
    return sendJson(res, 200, { wallet, entries, stats: { wins, losses, total, winRate } });
  });
  r.post("/matches", async (req, res) => {
    const body = req.body;
    const wallet = normalizeWallet2(body.wallet);
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    if (body.result !== "WIN" && body.result !== "LOSS") {
      return sendJson(res, 400, { error: "result must be WIN or LOSS" });
    }
    const opponent = (body.opponent ?? "Opponent").trim();
    const reward = (body.reward ?? "N/A").trim();
    const nftsWon = Array.isArray(body.nftsWon) ? body.nftsWon : [];
    const mode = (body.mode ?? "multiplayer").trim();
    await dbQuery(
      `
      insert into match_history (wallet, external_match_id, opponent, result, reward, nfts_won, mode, created_at)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7, now())
      on conflict (wallet, external_match_id) where external_match_id is not null do nothing
      `,
      [wallet, body.externalMatchId ?? null, opponent, body.result, reward, JSON.stringify(nftsWon), mode]
    );
    return sendJson(res, 200, { ok: true });
  });
  r.get("/creator/:wallet/dashboard", async (req, res) => {
    const wallet = normalizeWallet2(req.params.wallet);
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    const campaignsOut = await dbQuery(
      `select count(*)::text as count from creator_campaigns where creator_wallet = $1`,
      [wallet]
    );
    const collectionsOut = await dbQuery(
      `select count(*)::text as count from creator_collections where creator_wallet = $1`,
      [wallet]
    );
    const earningsOut = await dbQuery(
      `select total_royale, by_campaign from creator_earnings where creator = $1`,
      [wallet]
    );
    const earnings = earningsOut.rows[0] ?? { total_royale: 0, by_campaign: {} };
    return sendJson(res, 200, {
      wallet,
      stats: {
        campaigns: Number(campaignsOut.rows[0]?.count ?? 0),
        collections: Number(collectionsOut.rows[0]?.count ?? 0),
        totalEarnings: earnings.total_royale
      },
      byCampaign: earnings.by_campaign ?? {}
    });
  });
  r.get("/creator/:wallet/campaigns", async (req, res) => {
    const wallet = normalizeWallet2(req.params.wallet);
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    const out = await dbQuery(
      `select * from creator_campaigns where creator_wallet = $1 order by created_at desc`,
      [wallet]
    );
    return sendJson(res, 200, { campaigns: out.rows });
  });
  r.post("/creator/:wallet/campaigns", async (req, res) => {
    const wallet = normalizeWallet2(req.params.wallet);
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    const body = req.body;
    const name = body.name?.trim();
    const theme = body.theme?.trim();
    if (!name || !theme) return sendJson(res, 400, { error: "name and theme are required" });
    const linkedCollectionId = body.linkedCollectionId?.trim() || void 0;
    if (linkedCollectionId) {
      const linked = await dbQuery(
        `select id from creator_collections where id = $1 and creator_wallet = $2`,
        [linkedCollectionId, wallet]
      );
      if (!linked.rows[0]) return sendJson(res, 400, { error: "linkedCollectionId not found for this creator" });
    }
    const mergedConfig = {
      ...body.config ?? {},
      ...linkedCollectionId ? { linkedCollectionId } : {}
    };
    const id = `creator-${nanoid2(10)}`;
    await dbQuery(
      `
      insert into creator_campaigns (
        id, creator_wallet, name, theme, min_deck_size, entry_ticket_cost, reward_pool, base_royale_reward,
        prize_preview, status, config_json, created_at, updated_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,now(),now())
      `,
      [
        id,
        wallet,
        name,
        theme,
        Math.max(3, Math.floor(body.minDeckSize ?? 5)),
        Math.max(0, Math.floor(body.entryTicketCost ?? 5)),
        Math.max(0, Math.floor(body.rewardPool ?? 0)),
        Math.max(1, Math.floor(body.baseRoyaleReward ?? 10)),
        (body.prizePreview ?? "").trim(),
        (body.status ?? "draft").trim(),
        JSON.stringify(mergedConfig)
      ]
    );
    return sendJson(res, 200, { ok: true, id });
  });
  r.get("/creator/:wallet/collections", async (req, res) => {
    const wallet = normalizeWallet2(req.params.wallet);
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    const out = await dbQuery(
      `select * from creator_collections where creator_wallet = $1 order by created_at desc`,
      [wallet]
    );
    return sendJson(res, 200, { collections: out.rows });
  });
  r.post("/creator/:wallet/collections", async (req, res) => {
    const wallet = normalizeWallet2(req.params.wallet);
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    const body = req.body;
    const name = body.name?.trim();
    if (!name) return sendJson(res, 400, { error: "name is required" });
    const metadata = {
      ...body.metadata ?? {},
      imageUri: body.imageUri?.trim() || null,
      externalUrl: body.externalUrl?.trim() || null,
      collectionMetadataUri: body.collectionMetadataUri?.trim() || null,
      feePercent: typeof body.feePercent === "number" ? body.feePercent : null,
      collectionMint: body.collectionMint?.trim() || null,
      mintingRules: body.mintingRules ?? null,
      metadataTemplate: body.metadataTemplate ?? null,
      verificationSignerRef: body.verificationSignerRef?.trim() || null,
      merkleTree: body.merkleTree?.trim() || null,
      chainStatus: body.collectionMint ? "configured" : "draft"
    };
    const id = `collection-${nanoid2(10)}`;
    await dbQuery(
      `
      insert into creator_collections (
        id, creator_wallet, name, symbol, description, supply, status, metadata_json, created_at, updated_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,now(),now())
      `,
      [
        id,
        wallet,
        name,
        body.symbol?.trim() || null,
        body.description?.trim() || null,
        Math.max(0, Math.floor(body.supply ?? 0)),
        (body.status ?? "draft").trim(),
        JSON.stringify(metadata)
      ]
    );
    return sendJson(res, 200, { ok: true, id });
  });
  r.post("/creator/:wallet/collections/:collectionId/mint/prepare", async (req, res) => {
    const wallet = normalizeWallet2(req.params.wallet);
    const collectionId = req.params.collectionId?.trim();
    if (!wallet || !collectionId) return sendJson(res, 400, { error: "wallet and collectionId are required" });
    const collectionOut = await dbQuery(
      `select id, name, metadata_json from creator_collections where id = $1 and creator_wallet = $2`,
      [collectionId, wallet]
    );
    const collection = collectionOut.rows[0];
    if (!collection) return sendJson(res, 404, { error: "Collection not found" });
    const body = req.body;
    if (!body.recipientWallet?.trim()) return sendJson(res, 400, { error: "recipientWallet is required" });
    return sendJson(res, 200, {
      ok: true,
      type: "prepared_mint_request",
      collectionId: collection.id,
      collectionName: collection.name,
      recipientWallet: body.recipientWallet.trim(),
      payload: {
        itemName: body.itemName?.trim() || "Campaign Reward NFT",
        itemUri: body.itemUri?.trim() || "",
        attributes: body.attributes ?? []
      },
      notes: [
        "This endpoint prepares mint intent for server signer flow.",
        "Next integration: execute mint + collection verification with backend signer."
      ]
    });
  });
  r.post("/creator/:wallet/collections/:collectionId/bootstrap/collection", async (req, res) => {
    const wallet = normalizeWallet2(req.params.wallet);
    const collectionId = req.params.collectionId?.trim();
    if (!wallet || !collectionId) return sendJson(res, 400, { error: "wallet and collectionId are required" });
    const out = await dbQuery(
      `select id, name, symbol, metadata_json from creator_collections where id = $1 and creator_wallet = $2`,
      [collectionId, wallet]
    );
    const row = out.rows[0];
    if (!row) return sendJson(res, 404, { error: "Collection not found" });
    const body = req.body;
    const metadataUri = body.metadataUri?.trim() || typeof row.metadata_json?.collectionMetadataUri === "string" && row.metadata_json.collectionMetadataUri.trim() || typeof row.metadata_json?.metadataUri === "string" && row.metadata_json.metadataUri.trim() || null;
    if (!metadataUri) {
      return sendJson(res, 400, {
        error: "metadata uri missing. Set collectionMetadataUri/metadataUri in collection metadata first."
      });
    }
    const minted = await bootstrapCollectionNft({
      name: body.name?.trim() || row.name,
      symbol: body.symbol?.trim() || row.symbol,
      metadataUri,
      sellerFeePercent: body.feePercent ?? 0
    });
    const nextMetadata = {
      ...row.metadata_json ?? {},
      collectionMetadataUri: metadataUri,
      imageUri: body.imageUri?.trim() || row.metadata_json?.imageUri || null,
      externalUrl: body.externalUrl?.trim() || row.metadata_json?.externalUrl || null,
      description: body.description?.trim() || row.metadata_json?.description || null,
      collectionMint: minted.collectionMint,
      collectionCreateTx: minted.txSignature,
      chainStatus: "collection_created"
    };
    await dbQuery(
      `update creator_collections set metadata_json = $2::jsonb, updated_at = now() where id = $1`,
      [collectionId, JSON.stringify(nextMetadata)]
    );
    return sendJson(res, 200, { ok: true, collectionMint: minted.collectionMint, txSignature: minted.txSignature });
  });
  r.post("/creator/:wallet/collections/:collectionId/bootstrap/merkle", async (req, res) => {
    const wallet = normalizeWallet2(req.params.wallet);
    const collectionId = req.params.collectionId?.trim();
    if (!wallet || !collectionId) return sendJson(res, 400, { error: "wallet and collectionId are required" });
    const out = await dbQuery(
      `select id, metadata_json from creator_collections where id = $1 and creator_wallet = $2`,
      [collectionId, wallet]
    );
    const row = out.rows[0];
    if (!row) return sendJson(res, 404, { error: "Collection not found" });
    const body = req.body;
    const created = await bootstrapMerkleTree({
      maxDepth: body.maxDepth,
      maxBufferSize: body.maxBufferSize
    });
    const nextMetadata = {
      ...row.metadata_json ?? {},
      merkleTree: created.merkleTree,
      merkleCreateTx: created.txSignature,
      chainStatus: "merkle_created"
    };
    await dbQuery(
      `update creator_collections set metadata_json = $2::jsonb, updated_at = now() where id = $1`,
      [collectionId, JSON.stringify(nextMetadata)]
    );
    return sendJson(res, 200, { ok: true, merkleTree: created.merkleTree, txSignature: created.txSignature });
  });
  r.get("/creator/:wallet/campaigns/:campaignId/stage-rewards", async (req, res) => {
    const wallet = normalizeWallet2(req.params.wallet);
    const campaignId = req.params.campaignId?.trim();
    if (!wallet || !campaignId) return sendJson(res, 400, { error: "wallet and campaignId are required" });
    const own = await dbQuery(
      `select id from creator_campaigns where id = $1 and creator_wallet = $2`,
      [campaignId, wallet]
    );
    if (!own.rows[0]) return sendJson(res, 404, { error: "Campaign not found for this creator" });
    const out = await dbQuery(
      `
      select stage_index, reward_name, metadata_uri, image_uri, rarity, supply_cap, status
      from campaign_stage_rewards
      where campaign_id = $1
      order by stage_index asc
      `,
      [campaignId]
    );
    return sendJson(res, 200, { campaignId, rewards: out.rows });
  });
  r.post("/creator/:wallet/campaigns/:campaignId/stage-rewards", async (req, res) => {
    const wallet = normalizeWallet2(req.params.wallet);
    const campaignId = req.params.campaignId?.trim();
    if (!wallet || !campaignId) return sendJson(res, 400, { error: "wallet and campaignId are required" });
    const own = await dbQuery(
      `select id from creator_campaigns where id = $1 and creator_wallet = $2`,
      [campaignId, wallet]
    );
    if (!own.rows[0]) return sendJson(res, 404, { error: "Campaign not found for this creator" });
    const body = req.body;
    const rewards = Array.isArray(body.rewards) ? body.rewards : [];
    if (rewards.length === 0) return sendJson(res, 400, { error: "rewards are required" });
    for (const rwd of rewards) {
      const stageIndex = Math.max(0, Math.min(3, Math.floor(rwd.stageIndex)));
      const rewardName = (rwd.rewardName ?? "").trim();
      const metadataUri = (rwd.metadataUri ?? "").trim();
      if (!rewardName || !metadataUri) {
        return sendJson(res, 400, { error: "rewardName and metadataUri are required for each stage" });
      }
      await dbQuery(
        `
        insert into campaign_stage_rewards (
          campaign_id, stage_index, reward_name, metadata_uri, image_uri, rarity, supply_cap, status, updated_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,now())
        on conflict (campaign_id, stage_index)
        do update set reward_name=$3, metadata_uri=$4, image_uri=$5, rarity=$6, supply_cap=$7, status=$8, updated_at=now()
        `,
        [
          campaignId,
          stageIndex,
          rewardName,
          metadataUri,
          rwd.imageUri?.trim() || null,
          rwd.rarity?.trim() || null,
          rwd.supplyCap != null ? Math.max(0, Math.floor(rwd.supplyCap)) : null,
          rwd.status?.trim() || "active"
        ]
      );
    }
    return sendJson(res, 200, { ok: true });
  });
  r.post("/creator/:wallet/campaigns/:campaignId/publish-live", async (req, res) => {
    const wallet = normalizeWallet2(req.params.wallet);
    const campaignId = req.params.campaignId?.trim();
    if (!wallet || !campaignId) return sendJson(res, 400, { error: "wallet and campaignId are required" });
    const campaignOut = await dbQuery(
      `select id, config_json from creator_campaigns where id = $1 and creator_wallet = $2`,
      [campaignId, wallet]
    );
    const campaign = campaignOut.rows[0];
    if (!campaign) return sendJson(res, 404, { error: "Campaign not found for this creator" });
    const linkedCollectionId = typeof campaign.config_json?.linkedCollectionId === "string" ? campaign.config_json.linkedCollectionId : null;
    if (!linkedCollectionId) return sendJson(res, 400, { error: "Link a collection before publishing" });
    const colOut = await dbQuery(
      `select metadata_json from creator_collections where id = $1 and creator_wallet = $2`,
      [linkedCollectionId, wallet]
    );
    const metadata = colOut.rows[0]?.metadata_json;
    if (!metadata) return sendJson(res, 400, { error: "Linked collection not found" });
    const hasMint = typeof metadata.collectionMint === "string" && metadata.collectionMint.trim().length > 0;
    const hasMerkle = typeof metadata.merkleTree === "string" && metadata.merkleTree.trim().length > 0;
    if (!hasMint || !hasMerkle) {
      return sendJson(res, 400, { error: "Collection must have on-chain mint and merkle tree before going live" });
    }
    const rewards = await dbQuery(
      `select count(*)::text as count from campaign_stage_rewards where campaign_id = $1 and status = 'active'`,
      [campaignId]
    );
    if (Number(rewards.rows[0]?.count ?? 0) < 4) {
      return sendJson(res, 400, { error: "Configure all 4 stage rewards before publishing live" });
    }
    await dbQuery(`update creator_campaigns set status='published', updated_at=now() where id=$1`, [campaignId]);
    return sendJson(res, 200, { ok: true, status: "published" });
  });
  r.post("/creator/:wallet/launch-campaign", async (req, res) => {
    const wallet = normalizeWallet2(req.params.wallet);
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    const body = req.body;
    const campaignName = body.campaignName?.trim();
    const campaignTheme = body.campaignTheme?.trim();
    const collectionName = body.collectionName?.trim();
    const collectionMetadataUri = body.collectionMetadataUri?.trim();
    const supply = Math.max(0, Math.floor(body.supply ?? 0));
    if (!campaignName || !campaignTheme || !collectionName || !collectionMetadataUri) {
      return sendJson(res, 400, {
        error: "campaignName, campaignTheme, collectionName and collectionMetadataUri are required"
      });
    }
    const collectionId = `collection-${nanoid2(10)}`;
    const campaignId = `creator-${nanoid2(10)}`;
    const collectionCreate = await bootstrapCollectionNft({
      name: collectionName,
      symbol: body.collectionSymbol?.trim() || "DRIP",
      metadataUri: collectionMetadataUri,
      sellerFeePercent: body.feePercent ?? 0
    });
    const merkleCreate = await bootstrapMerkleTree({
      maxDepth: body.merkleMaxDepth,
      maxBufferSize: body.merkleMaxBufferSize
    });
    await dbQuery(
      `
      insert into creator_collections (
        id, creator_wallet, name, symbol, description, supply, status, metadata_json, created_at, updated_at
      )
      values ($1,$2,$3,$4,$5,$6,'active',$7::jsonb,now(),now())
      `,
      [
        collectionId,
        wallet,
        collectionName,
        body.collectionSymbol?.trim() || null,
        null,
        supply,
        JSON.stringify({
          collectionSupply: supply,
          imageUri: body.collectionImageUri?.trim() || null,
          externalUrl: body.collectionExternalUrl?.trim() || null,
          collectionMetadataUri,
          collectionMint: collectionCreate.collectionMint,
          collectionCreateTx: collectionCreate.txSignature,
          merkleTree: merkleCreate.merkleTree,
          merkleCreateTx: merkleCreate.txSignature,
          chainStatus: "ready"
        })
      ]
    );
    await dbQuery(
      `
      insert into creator_campaigns (
        id, creator_wallet, name, theme, min_deck_size, entry_ticket_cost, reward_pool, base_royale_reward, prize_preview, status, config_json, created_at, updated_at
      )
      values ($1,$2,$3,$4,5,$5,0,$6,'Stage Rewards cNFT','draft',$7::jsonb,now(),now())
      `,
      [
        campaignId,
        wallet,
        campaignName,
        campaignTheme,
        Math.max(0, Math.floor(body.entryTicketCost ?? 5)),
        Math.max(1, Math.floor(body.baseRoyaleReward ?? 10)),
        JSON.stringify({ linkedCollectionId: collectionId })
      ]
    );
    return sendJson(res, 200, {
      ok: true,
      campaignId,
      collectionId,
      collectionMint: collectionCreate.collectionMint,
      merkleTree: merkleCreate.merkleTree,
      txs: { collectionCreate: collectionCreate.txSignature, merkleCreate: merkleCreate.txSignature }
    });
  });
  return r;
}

// server/index.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
async function startServer() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required. Add DATABASE_URL in environment before starting server.");
  }
  await ensureDatabaseAvailable();
  console.log("[db] PostgreSQL connection verified");
  const app = express5();
  const server = createServer(app);
  const matchmaking = createMatchmakingWsServer();
  app.use("/api/escrow", createEscrowRouter());
  app.use("/api/tokenomics", createTokenomicsRouter());
  app.use("/api/campaigns", createSoloCampaignRouter());
  app.use("/api/users", createUsersRouter());
  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    if (url.startsWith("/ws/matchmaking")) {
      matchmaking.handleUpgrade(req, socket, head);
      return;
    }
  });
  const staticPath = process.env.NODE_ENV === "production" ? path2.resolve(__dirname, "public") : path2.resolve(__dirname, "..", "dist", "public");
  app.use(express5.static(staticPath));
  app.get("*", (_req, res) => {
    res.sendFile(path2.join(staticPath, "index.html"));
  });
  const port = process.env.PORT || 3e3;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
