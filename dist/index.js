// server/index.ts
import express4 from "express";
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
var walletBalances = /* @__PURE__ */ new Map();
var spendableTickets = /* @__PURE__ */ new Map();
var starterDistributed = /* @__PURE__ */ new Set();
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
function getRoyaleBalance(wallet) {
  const key = normalizeWallet(wallet);
  if (!starterDistributed.has(key)) {
    starterDistributed.add(key);
    walletBalances.set(key, STARTER_AIRDROP);
  }
  return walletBalances.get(key) ?? 0;
}
function distributeRoyale(wallet, amount) {
  const key = normalizeWallet(wallet);
  const current = walletBalances.get(key) ?? 0;
  const next = current + Math.max(0, Math.floor(amount));
  walletBalances.set(key, next);
  return { balance: next };
}
function spendRoyale(wallet, amount) {
  const key = normalizeWallet(wallet);
  const current = walletBalances.get(key) ?? 0;
  const spend = Math.max(0, Math.floor(amount));
  if (current < spend) {
    return { ok: false, error: "Insufficient ROYALE balance" };
  }
  const next = current - spend;
  walletBalances.set(key, next);
  return { ok: true, balance: next };
}
function addChallengeTickets(wallet, count) {
  const key = normalizeWallet(wallet);
  const current = spendableTickets.get(key) ?? 0;
  const next = current + Math.max(0, Math.floor(count));
  spendableTickets.set(key, next);
  return next;
}
function consumeChallengeTicket(wallet) {
  const key = normalizeWallet(wallet);
  const current = spendableTickets.get(key) ?? 0;
  if (current <= 0) return { ok: false, error: "No challenge tickets left" };
  const next = current - 1;
  spendableTickets.set(key, next);
  return { ok: true, remaining: next };
}
function getChallengeTickets(wallet) {
  const key = normalizeWallet(wallet);
  return spendableTickets.get(key) ?? 0;
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
  r.get("/balance/:wallet", (req, res) => {
    const wallet = req.params.wallet;
    if (!wallet) {
      sendJson(res, 400, { error: "Missing wallet" });
      return;
    }
    sendJson(res, 200, {
      wallet,
      royaleBalance: getRoyaleBalance(wallet),
      challengeTickets: getChallengeTickets(wallet)
    });
  });
  r.post("/distribute", (req, res) => {
    const body = req.body;
    if (!body.wallet || typeof body.amount !== "number" || body.amount <= 0) {
      sendJson(res, 400, { error: "wallet and positive amount are required" });
      return;
    }
    const out = distributeRoyale(body.wallet, body.amount);
    sendJson(res, 200, { ok: true, wallet: body.wallet, royaleBalance: out.balance });
  });
  r.post("/airdrop", (req, res) => {
    const body = req.body;
    if (!body.wallet) {
      sendJson(res, 400, { error: "wallet is required" });
      return;
    }
    const out = distributeRoyale(body.wallet, 100);
    sendJson(res, 200, { ok: true, wallet: body.wallet, royaleBalance: out.balance, airdropped: 100 });
  });
  r.post("/tickets/purchase", (req, res) => {
    const body = req.body;
    const wallet = body.wallet;
    const ticketCount = Math.max(1, Math.floor(body.ticketCount ?? 1));
    const royaleCostPerTicket = Math.max(1, Math.floor(body.royaleCostPerTicket ?? 5));
    if (!wallet) {
      sendJson(res, 400, { error: "wallet is required" });
      return;
    }
    const spendResult = spendRoyale(wallet, ticketCount * royaleCostPerTicket);
    if (!spendResult.ok) {
      sendJson(res, 400, { error: spendResult.error });
      return;
    }
    const tickets = addChallengeTickets(wallet, ticketCount);
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
var campaigns = [
  {
    id: "mvp-training",
    name: "MVP Training Grounds",
    theme: "Simulation Sandbox",
    creator: "DRiP System",
    minDeckSize: 3,
    rewardPool: 999,
    baseRoyaleReward: 8,
    entryTicketCost: 2,
    prizePreview: "Training Relic cNFT"
  },
  {
    id: "neon-citadel",
    name: "Neon Citadel",
    theme: "Cyber Landmark",
    creator: "DRiP Creator Alpha",
    minDeckSize: 5,
    rewardPool: 120,
    baseRoyaleReward: 12,
    entryTicketCost: 5,
    prizePreview: "Neon Crown (Rare cNFT)"
  },
  {
    id: "void-gallery",
    name: "Void Gallery",
    theme: "Abstract Void",
    creator: "DRiP Creator Sigma",
    minDeckSize: 5,
    rewardPool: 90,
    baseRoyaleReward: 15,
    entryTicketCost: 8,
    prizePreview: "Void Curator Key (Epic cNFT)"
  },
  {
    id: "drip-jungle-rush",
    name: "Jungle Rush: Ape Protocol",
    theme: "Primal Neon Jungle",
    creator: "Ape Protocol",
    minDeckSize: 4,
    rewardPool: 74,
    baseRoyaleReward: 18,
    entryTicketCost: 6,
    prizePreview: "Golden Canopy Totem (Rare cNFT)"
  },
  {
    id: "sol-symphony",
    name: "Sol Symphony Arena",
    theme: "Audio-Reactive Metaverse Stage",
    creator: "PulseForge",
    minDeckSize: 6,
    rewardPool: 52,
    baseRoyaleReward: 22,
    entryTicketCost: 10,
    prizePreview: "Symphony Core Pass (Epic cNFT)"
  },
  {
    id: "frost-byte-bastion",
    name: "Frostbyte Bastion",
    theme: "Cryo-Digital Fortress",
    creator: "ByteWarden",
    minDeckSize: 5,
    rewardPool: 40,
    baseRoyaleReward: 28,
    entryTicketCost: 12,
    prizePreview: "Glacial Cipher Sigil (Epic cNFT)"
  },
  {
    id: "eclipse-catacomb",
    name: "Eclipse Catacomb",
    theme: "Shadow Relic Underworld",
    creator: "Night Archive",
    minDeckSize: 7,
    rewardPool: 26,
    baseRoyaleReward: 35,
    entryTicketCost: 15,
    prizePreview: "Umbral Archive Shard (Legendary cNFT)"
  }
];
var playerProgress = /* @__PURE__ */ new Map();
var runs = /* @__PURE__ */ new Map();
var entries = /* @__PURE__ */ new Map();
var creatorEarnings = /* @__PURE__ */ new Map();
var campaignRoyaleFunds = /* @__PURE__ */ new Map();
var STAGES = ["Match 1", "Match 2", "Match 3", "Boss"];
var ENTRY_SPLIT = { creator: 50, rewardPool: 35, protocol: 15 };
function splitEntry(amount) {
  const creator = Math.floor(amount * ENTRY_SPLIT.creator / 100);
  const rewardPool = Math.floor(amount * ENTRY_SPLIT.rewardPool / 100);
  const protocol = Math.max(0, amount - creator - rewardPool);
  return { creator, rewardPool, protocol };
}
function ensureCreatorEarnings(creator) {
  const existing = creatorEarnings.get(creator);
  if (existing) return existing;
  const next = { creator, totalRoyale: 0, byCampaign: {} };
  creatorEarnings.set(creator, next);
  return next;
}
function ensureCampaignFunds(campaignId) {
  const existing = campaignRoyaleFunds.get(campaignId);
  if (existing) return existing;
  const next = { rewardPoolRoyale: 0, protocolRoyale: 0 };
  campaignRoyaleFunds.set(campaignId, next);
  return next;
}
function progressFor(wallet, campaignId) {
  let byCampaign = playerProgress.get(wallet);
  if (!byCampaign) {
    byCampaign = /* @__PURE__ */ new Map();
    playerProgress.set(wallet, byCampaign);
  }
  let p = byCampaign.get(campaignId);
  if (!p) {
    p = {
      completedChapters: 0,
      wins: 0,
      losses: 0,
      bestDifficulty: null,
      claimedRewards: 0
    };
    byCampaign.set(campaignId, p);
  }
  return p;
}
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
function runResponse(run, campaign) {
  return {
    ok: true,
    runId: run.runId,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      rewardPool: campaign.rewardPool
    },
    status: run.status,
    stageIndex: run.stageIndex,
    stageLabel: STAGES[run.stageIndex] ?? STAGES[3],
    match: run.match,
    prompt: run.prompt,
    royaleReward: run.royaleReward,
    rewardGranted: run.rewardGranted,
    royaleBalance: getRoyaleBalance(run.wallet),
    challengeTickets: getChallengeTickets(run.wallet)
  };
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
function updateProgressOnStageResult(run, campaign) {
  const progress = progressFor(run.wallet, campaign.id);
  if (!run.match || run.match.isActive) return;
  const stageFlawless = run.match.roundResults.every((r) => r.winner !== "player2");
  run.allFlawless = run.allFlawless && stageFlawless;
  if (run.match.winner === "player1") {
    progress.completedChapters += 1;
    if (run.stageIndex >= 3) {
      progress.wins += 1;
      progress.bestDifficulty = difficultyRank(run.difficulty) > difficultyRank(progress.bestDifficulty) ? run.difficulty : progress.bestDifficulty;
      const base = Math.floor(campaign.baseRoyaleReward * difficultyScale(run.difficulty));
      run.royaleReward = run.allFlawless ? base + 3 : base;
      distributeRoyale(run.wallet, run.royaleReward);
      run.rewardGranted = campaign.rewardPool > 0;
      if (run.rewardGranted) {
        campaign.rewardPool -= 1;
        progress.claimedRewards += 1;
      }
      if (run.allFlawless) addChallengeTickets(run.wallet, 1);
      run.status = "completed";
      run.prompt = "Boss defeated. Campaign cleared.";
      return;
    }
    run.status = "stage_won";
    run.prompt = `${STAGES[run.stageIndex]} cleared. Continue to next match.`;
    return;
  }
  progress.losses += 1;
  run.status = "lost";
  run.prompt = `Defeated at ${STAGES[run.stageIndex]}. Return to campaign page.`;
}
function createSoloCampaignRouter() {
  const r = Router3();
  r.use(express3.json({ limit: "512kb" }));
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
  r.get("/", (_req, res) => {
    sendJson(res, 200, { campaigns });
  });
  r.get("/creators/:creator/earnings", (req, res) => {
    const creator = decodeURIComponent(req.params.creator || "").trim();
    if (!creator) {
      sendJson(res, 400, { error: "creator is required" });
      return;
    }
    const out = ensureCreatorEarnings(creator);
    sendJson(res, 200, out);
  });
  r.get("/progress/:wallet", (req, res) => {
    const wallet = req.params.wallet;
    const byCampaign = playerProgress.get(wallet);
    const progress = campaigns.map((campaign) => ({
      campaignId: campaign.id,
      ...byCampaign?.get(campaign.id) ?? {
        completedChapters: 0,
        wins: 0,
        losses: 0,
        bestDifficulty: null,
        claimedRewards: 0
      }
    }));
    sendJson(res, 200, {
      wallet,
      progress,
      royaleBalance: getRoyaleBalance(wallet),
      challengeTickets: getChallengeTickets(wallet)
    });
  });
  r.post("/:campaignId/deposit", (req, res) => {
    const campaign = campaigns.find((c) => c.id === req.params.campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return;
    }
    const body = req.body;
    const rewardCount = Math.max(1, Math.floor(body.rewardCount ?? 1));
    campaign.rewardPool += rewardCount;
    sendJson(res, 200, { ok: true, campaignId: campaign.id, rewardPool: campaign.rewardPool });
  });
  r.post("/:campaignId/entry/preview", (req, res) => {
    const campaign = campaigns.find((c) => c.id === req.params.campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return;
    }
    const amount = Math.max(0, Math.floor(campaign.entryTicketCost));
    const split = splitEntry(amount);
    const wallet = req.body?.walletAddress?.trim();
    sendJson(res, 200, {
      campaignId: campaign.id,
      amount,
      split,
      splitPct: ENTRY_SPLIT,
      royaleBalance: wallet ? getRoyaleBalance(wallet) : void 0,
      canAfford: wallet ? getRoyaleBalance(wallet) >= amount : void 0
    });
  });
  r.post("/:campaignId/entry/commit", (req, res) => {
    const campaign = campaigns.find((c) => c.id === req.params.campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return;
    }
    const body = req.body;
    const wallet = body.walletAddress?.trim();
    if (!wallet) {
      sendJson(res, 400, { error: "walletAddress is required" });
      return;
    }
    const amount = Math.max(0, Math.floor(campaign.entryTicketCost));
    const split = splitEntry(amount);
    if (amount > 0) {
      const spent = spendRoyale(wallet, amount);
      if (!spent.ok) {
        sendJson(res, 400, { error: spent.error });
        return;
      }
    }
    const creatorBook = ensureCreatorEarnings(campaign.creator);
    creatorBook.totalRoyale += split.creator;
    creatorBook.byCampaign[campaign.id] = (creatorBook.byCampaign[campaign.id] ?? 0) + split.creator;
    const funds = ensureCampaignFunds(campaign.id);
    funds.rewardPoolRoyale += split.rewardPool;
    funds.protocolRoyale += split.protocol;
    const entryId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      entryId,
      wallet,
      campaignId: campaign.id,
      amount,
      split,
      status: "committed",
      createdAt: Date.now()
    };
    entries.set(entryId, record);
    sendJson(res, 200, {
      ok: true,
      entryId,
      campaignId: campaign.id,
      amount,
      split,
      royaleBalance: getRoyaleBalance(wallet),
      challengeTickets: getChallengeTickets(wallet),
      creatorTotalRoyale: creatorBook.totalRoyale,
      campaignFunds: funds
    });
  });
  r.post("/:campaignId/runs/start", (req, res) => {
    const campaign = campaigns.find((c) => c.id === req.params.campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return;
    }
    const body = req.body;
    const wallet = body.walletAddress?.trim();
    if (!wallet) {
      sendJson(res, 400, { error: "walletAddress is required" });
      return;
    }
    const deck = Array.isArray(body.deck) ? body.deck : [];
    if (deck.length < campaign.minDeckSize) {
      sendJson(res, 400, { error: `Minimum deck size is ${campaign.minDeckSize}` });
      return;
    }
    const difficulty = body.difficulty === "hard" || body.difficulty === "nightmare" ? body.difficulty : "normal";
    const entryCost = Math.max(0, Math.floor(campaign.entryTicketCost));
    if (entryCost > 0) {
      const entryId = body.entryId?.trim();
      if (!entryId) {
        sendJson(res, 400, { error: "entryId is required for this campaign" });
        return;
      }
      const entry = entries.get(entryId);
      if (!entry) {
        sendJson(res, 400, { error: "Invalid entryId" });
        return;
      }
      if (entry.status !== "committed") {
        sendJson(res, 400, { error: "Entry already consumed" });
        return;
      }
      if (entry.wallet !== wallet || entry.campaignId !== campaign.id) {
        sendJson(res, 403, { error: "entryId does not belong to this wallet/campaign" });
        return;
      }
      entry.status = "consumed";
      entries.set(entryId, entry);
    }
    if (body.useTicket) {
      const spent = consumeChallengeTicket(wallet);
      if (!spent.ok) {
        sendJson(res, 400, { error: spent.error });
        return;
      }
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
    runs.set(runId, run);
    if (body.entryId) {
      const e = entries.get(body.entryId);
      if (e && e.status === "consumed") {
        e.runId = runId;
        entries.set(body.entryId, e);
      }
    }
    sendJson(res, 200, runResponse(run, campaign));
  });
  r.get("/runs/:runId", (req, res) => {
    const run = runs.get(req.params.runId);
    if (!run) {
      sendJson(res, 404, { error: "Run not found" });
      return;
    }
    const campaign = campaigns.find((c) => c.id === run.campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return;
    }
    sendJson(res, 200, runResponse(run, campaign));
  });
  r.post("/runs/:runId/pick", (req, res) => {
    const run = runs.get(req.params.runId);
    if (!run) {
      sendJson(res, 404, { error: "Run not found" });
      return;
    }
    const campaign = campaigns.find((c) => c.id === run.campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return;
    }
    const body = req.body;
    if (!body.walletAddress || body.walletAddress !== run.wallet) {
      sendJson(res, 403, { error: "wallet mismatch" });
      return;
    }
    if (!body.assetId) {
      sendJson(res, 400, { error: "assetId is required" });
      return;
    }
    if (run.status !== "in_progress" || !run.match) {
      sendJson(res, 400, { error: "Run is not in an active match state" });
      return;
    }
    let next = submitPick(run.match, "player1", body.assetId);
    next = resolveAIPicks(next);
    run.match = next;
    if (!run.match.isActive) {
      updateProgressOnStageResult(run, campaign);
    }
    sendJson(res, 200, runResponse(run, campaign));
  });
  r.post("/runs/:runId/next", (req, res) => {
    const run = runs.get(req.params.runId);
    if (!run) {
      sendJson(res, 404, { error: "Run not found" });
      return;
    }
    const campaign = campaigns.find((c) => c.id === run.campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return;
    }
    const body = req.body;
    if (!body.walletAddress || body.walletAddress !== run.wallet) {
      sendJson(res, 403, { error: "wallet mismatch" });
      return;
    }
    if (run.status !== "stage_won") {
      sendJson(res, 400, { error: "Next stage unavailable for current run state" });
      return;
    }
    run.stageIndex = Math.min(3, run.stageIndex + 1);
    run.status = "in_progress";
    run.prompt = null;
    run.match = resolveAIPicks(initializeStageMatch(run));
    sendJson(res, 200, runResponse(run, campaign));
  });
  r.post("/runs/:runId/exit", (req, res) => {
    const run = runs.get(req.params.runId);
    if (!run) {
      sendJson(res, 404, { error: "Run not found" });
      return;
    }
    const body = req.body;
    if (!body.walletAddress || body.walletAddress !== run.wallet) {
      sendJson(res, 403, { error: "wallet mismatch" });
      return;
    }
    runs.delete(run.runId);
    sendJson(res, 200, { ok: true });
  });
  return r;
}

// server/index.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
async function startServer() {
  const app = express4();
  const server = createServer(app);
  const matchmaking = createMatchmakingWsServer();
  app.use("/api/escrow", createEscrowRouter());
  app.use("/api/tokenomics", createTokenomicsRouter());
  app.use("/api/campaigns", createSoloCampaignRouter());
  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    if (url.startsWith("/ws/matchmaking")) {
      matchmaking.handleUpgrade(req, socket, head);
      return;
    }
  });
  const staticPath = process.env.NODE_ENV === "production" ? path2.resolve(__dirname, "public") : path2.resolve(__dirname, "..", "dist", "public");
  app.use(express4.static(staticPath));
  app.get("*", (_req, res) => {
    res.sendFile(path2.join(staticPath, "index.html"));
  });
  const port = process.env.PORT || 3e3;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
