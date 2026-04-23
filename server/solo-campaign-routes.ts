import express, { Router } from "express";
import {
  type GameCard,
  type LocalMatch,
  initializeLocalMatch,
  submitPick,
} from "../shared/matchEngine";
import {
  addChallengeTickets,
  consumeChallengeTicket,
  distributeRoyale,
  getChallengeTickets,
  getRoyaleBalance,
} from "./tokenomics-store";

type Difficulty = "normal" | "hard" | "nightmare";
type RunStatus = "in_progress" | "stage_won" | "lost" | "completed";

type Campaign = {
  id: string;
  name: string;
  theme: string;
  creator: string;
  minDeckSize: number;
  rewardPool: number;
  baseRoyaleReward: number;
  entryTicketCost: number;
};

type Progress = {
  completedChapters: number;
  wins: number;
  losses: number;
  bestDifficulty: Difficulty | null;
  claimedRewards: number;
};

type CampaignRun = {
  runId: string;
  wallet: string;
  campaignId: string;
  difficulty: Difficulty;
  deck: GameCard[];
  stageIndex: number; // 0..3 => 1,2,3,boss
  status: RunStatus;
  match: LocalMatch | null;
  prompt: string | null;
  allFlawless: boolean;
  rewardGranted: boolean;
  royaleReward: number;
};

const campaigns: Campaign[] = [
  {
    id: "mvp-training",
    name: "MVP Training Grounds",
    theme: "Simulation Sandbox",
    creator: "DRiP System",
    minDeckSize: 3,
    rewardPool: 999,
    baseRoyaleReward: 8,
    entryTicketCost: 0,
  },
  {
    id: "neon-citadel",
    name: "Neon Citadel",
    theme: "Cyber Landmark",
    creator: "DRiP Creator Alpha",
    minDeckSize: 5,
    rewardPool: 120,
    baseRoyaleReward: 12,
    entryTicketCost: 0,
  },
  {
    id: "void-gallery",
    name: "Void Gallery",
    theme: "Abstract Void",
    creator: "DRiP Creator Sigma",
    minDeckSize: 5,
    rewardPool: 90,
    baseRoyaleReward: 15,
    entryTicketCost: 0,
  },
];

const playerProgress = new Map<string, Map<string, Progress>>();
const runs = new Map<string, CampaignRun>();
const STAGES = ["Match 1", "Match 2", "Match 3", "Boss"] as const;

function progressFor(wallet: string, campaignId: string): Progress {
  let byCampaign = playerProgress.get(wallet);
  if (!byCampaign) {
    byCampaign = new Map<string, Progress>();
    playerProgress.set(wallet, byCampaign);
  }
  let p = byCampaign.get(campaignId);
  if (!p) {
    p = {
      completedChapters: 0,
      wins: 0,
      losses: 0,
      bestDifficulty: null,
      claimedRewards: 0,
    };
    byCampaign.set(campaignId, p);
  }
  return p;
}

function difficultyScale(difficulty: Difficulty): number {
  if (difficulty === "hard") return 1.2;
  if (difficulty === "nightmare") return 1.45;
  return 1;
}

function difficultyRank(difficulty: Difficulty | null): number {
  if (difficulty === "nightmare") return 3;
  if (difficulty === "hard") return 2;
  if (difficulty === "normal") return 1;
  return 0;
}

function stageScale(stageIndex: number, difficulty: Difficulty): number {
  const stageBase = [0.95, 1.05, 1.15, 1.3][Math.max(0, Math.min(3, stageIndex))] ?? 1;
  return stageBase * difficultyScale(difficulty);
}

function randomInt(min: number, max: number): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function difficultyPowerBand(
  difficulty: Difficulty,
  stageIndex: number
): { min: number; max: number; boostChance: number } {
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

function opponentDeckFromPlayer(deck: GameCard[], difficulty: Difficulty, stageIndex: number): GameCard[] {
  const scale = stageScale(stageIndex, difficulty);
  const shuffled = [...deck].sort(() => Math.random() - 0.5);
  const band = difficultyPowerBand(difficulty, stageIndex);

  return deck.map((card, idx) => {
    const source = shuffled[idx % shuffled.length] ?? card;
    const scaled = Math.round(source.power * scale) + (stageIndex >= 2 ? 1 : 0);
    const randomBandPower = randomInt(band.min, band.max);
    const boosted =
      Math.random() < band.boostChance
        ? Math.max(scaled, randomBandPower)
        : Math.round((scaled + randomBandPower) / 2);
    const floorByDifficulty =
      difficulty === "nightmare" ? (stageIndex >= 2 ? 9 : 8) : difficulty === "hard" ? 6 : 4;
    const power = Math.max(2, Math.min(10, Math.max(floorByDifficulty, boosted)));

    return {
      assetId: `stage-${stageIndex}-${idx}-${source.assetId}`,
      imageUri: source.imageUri,
      name: `${STAGES[stageIndex]} ${source.name ?? "Card"}`,
      power,
    };
  });
}

function pickHighest(deck: GameCard[]): GameCard | null {
  if (deck.length === 0) return null;
  return [...deck].sort((a, b) => b.power - a.power)[0] ?? null;
}

function runResponse(run: CampaignRun, campaign: Campaign) {
  return {
    ok: true,
    runId: run.runId,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      rewardPool: campaign.rewardPool,
    },
    status: run.status,
    stageIndex: run.stageIndex,
    stageLabel: STAGES[run.stageIndex] ?? STAGES[3],
    match: run.match,
    prompt: run.prompt,
    royaleReward: run.royaleReward,
    rewardGranted: run.rewardGranted,
    royaleBalance: getRoyaleBalance(run.wallet),
    challengeTickets: getChallengeTickets(run.wallet),
  };
}

function initializeStageMatch(run: CampaignRun): LocalMatch {
  const opponentDeck = opponentDeckFromPlayer(run.deck, run.difficulty, run.stageIndex);
  return initializeLocalMatch(run.deck, opponentDeck, "You", STAGES[run.stageIndex] ?? "Boss");
}

function resolveAIPicks(match: LocalMatch): LocalMatch {
  let next = match;
  while (next.isActive && next.pickTurn === "player2") {
    const aiPick = pickHighest(next.player2.deck);
    if (!aiPick) break;
    next = submitPick(next, "player2", aiPick.assetId);
  }
  return next;
}

function updateProgressOnStageResult(run: CampaignRun, campaign: Campaign) {
  const progress = progressFor(run.wallet, campaign.id);
  if (!run.match || run.match.isActive) return;

  const stageFlawless = run.match.roundResults.every((r) => r.winner !== "player2");
  run.allFlawless = run.allFlawless && stageFlawless;

  if (run.match.winner === "player1") {
    progress.completedChapters += 1;
    if (run.stageIndex >= 3) {
      progress.wins += 1;
      progress.bestDifficulty =
        difficultyRank(run.difficulty) > difficultyRank(progress.bestDifficulty)
          ? run.difficulty
          : progress.bestDifficulty;

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

export function createSoloCampaignRouter(): Router {
  const r = Router();
  r.use(express.json({ limit: "512kb" }));
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

  r.get("/", (_req, res) => {
    sendJson(res, 200, { campaigns });
  });

  r.get("/progress/:wallet", (req, res) => {
    const wallet = req.params.wallet;
    const byCampaign = playerProgress.get(wallet);
    const progress = campaigns.map((campaign) => ({
      campaignId: campaign.id,
      ...(byCampaign?.get(campaign.id) ?? {
        completedChapters: 0,
        wins: 0,
        losses: 0,
        bestDifficulty: null,
        claimedRewards: 0,
      }),
    }));
    sendJson(res, 200, {
      wallet,
      progress,
      royaleBalance: getRoyaleBalance(wallet),
      challengeTickets: getChallengeTickets(wallet),
    });
  });

  r.post("/:campaignId/deposit", (req, res) => {
    const campaign = campaigns.find((c) => c.id === req.params.campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return;
    }
    const body = req.body as { rewardCount?: number };
    const rewardCount = Math.max(1, Math.floor(body.rewardCount ?? 1));
    campaign.rewardPool += rewardCount;
    sendJson(res, 200, { ok: true, campaignId: campaign.id, rewardPool: campaign.rewardPool });
  });

  r.post("/:campaignId/runs/start", (req, res) => {
    const campaign = campaigns.find((c) => c.id === req.params.campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return;
    }

    const body = req.body as {
      walletAddress?: string;
      deck?: GameCard[];
      difficulty?: Difficulty;
      useTicket?: boolean;
    };
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
    const difficulty: Difficulty =
      body.difficulty === "hard" || body.difficulty === "nightmare" ? body.difficulty : "normal";

    if (body.useTicket) {
      const spent = consumeChallengeTicket(wallet);
      if (!spent.ok) {
        sendJson(res, 400, { error: spent.error });
        return;
      }
    }

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const run: CampaignRun = {
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
      royaleReward: 0,
    };
    run.match = resolveAIPicks(initializeStageMatch(run));
    runs.set(runId, run);
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
    const body = req.body as { walletAddress?: string; assetId?: string };
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
    const body = req.body as { walletAddress?: string };
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
    const body = req.body as { walletAddress?: string };
    if (!body.walletAddress || body.walletAddress !== run.wallet) {
      sendJson(res, 403, { error: "wallet mismatch" });
      return;
    }
    runs.delete(run.runId);
    sendJson(res, 200, { ok: true });
  });

  return r;
}
