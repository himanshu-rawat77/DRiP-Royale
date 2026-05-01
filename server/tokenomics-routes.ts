import express, { Router } from "express";
import {
  addChallengeTickets,
  distributeRoyale,
  getChallengeTickets,
  getRoyaleBalance,
  getTokenomicsConfig,
  spendRoyale,
} from "./tokenomics-store";

export function createTokenomicsRouter(): Router {
  const r = Router();
  r.use(express.json({ limit: "256kb" }));
  const sendJson = (res: any, status: number, payload: any) => {
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
      challengeTickets: getChallengeTickets(wallet),
    });
  });

  // Phase 1 MVP: manual distribution for testing/admin operations.
  r.post("/distribute", (req, res) => {
    const body = req.body as { wallet?: string; amount?: number };
    if (!body.wallet || typeof body.amount !== "number" || body.amount <= 0) {
      sendJson(res, 400, { error: "wallet and positive amount are required" });
      return;
    }
    const out = distributeRoyale(body.wallet, body.amount);
    sendJson(res, 200, { ok: true, wallet: body.wallet, royaleBalance: out.balance });
  });

  r.post("/airdrop", (req, res) => {
    const body = req.body as { wallet?: string };
    if (!body.wallet) {
      sendJson(res, 400, { error: "wallet is required" });
      return;
    }
    const out = distributeRoyale(body.wallet, 100);
    sendJson(res, 200, { ok: true, wallet: body.wallet, royaleBalance: out.balance, airdropped: 100 });
  });

  r.post("/tickets/purchase", (req, res) => {
    const body = req.body as { wallet?: string; ticketCount?: number; royaleCostPerTicket?: number };
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
      challengeTickets: tickets,
    });
  });

  return r;
}
