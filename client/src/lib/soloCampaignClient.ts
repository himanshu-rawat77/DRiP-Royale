import type { GameCard } from "./types";
import type { LocalMatch } from "@shared/matchEngine";

export type CampaignDifficulty = "normal" | "hard" | "nightmare";

export interface CampaignSummary {
  id: string;
  name: string;
  theme: string;
  creator: string;
  minDeckSize: number;
  rewardPool: number;
  baseRoyaleReward: number;
  entryTicketCost: number;
}

export interface CampaignProgress {
  campaignId: string;
  completedChapters: number;
  wins: number;
  losses: number;
  bestDifficulty: CampaignDifficulty | null;
  claimedRewards: number;
}

export interface CampaignProgressResponse {
  wallet: string;
  royaleBalance: number;
  challengeTickets: number;
  progress: CampaignProgress[];
}

export interface CampaignBattleResult {
  ok: boolean;
  campaign: { id: string; rewardPool: number };
  result: {
    won: boolean;
    rounds: number;
    flawless: boolean;
    winner: "player1" | "player2" | null;
  };
  royaleReward: number;
  rewardGranted: boolean;
  royaleBalance: number;
  challengeTickets: number;
  progress: CampaignProgress;
}

export type CampaignRunStatus = "in_progress" | "stage_won" | "lost" | "completed";

export interface CampaignRunState {
  runId: string;
  campaign: { id: string; name: string; rewardPool: number };
  status: CampaignRunStatus;
  stageIndex: number;
  stageLabel: string;
  match: LocalMatch | null;
  prompt: string | null;
  royaleReward: number;
  rewardGranted: boolean;
  royaleBalance: number;
  challengeTickets: number;
}

export async function fetchCampaigns(): Promise<CampaignSummary[]> {
  const res = await fetch("/api/campaigns");
  if (!res.ok) throw new Error("Failed to load campaigns");
  const data = (await res.json()) as { campaigns: CampaignSummary[] };
  return data.campaigns;
}

export async function fetchCampaignProgress(wallet: string): Promise<CampaignProgressResponse> {
  const res = await fetch(`/api/campaigns/progress/${encodeURIComponent(wallet)}`);
  if (!res.ok) throw new Error("Failed to load campaign progress");
  return res.json() as Promise<CampaignProgressResponse>;
}

export async function simulateCampaignBattle(input: {
  campaignId: string;
  walletAddress: string;
  deck: GameCard[];
  difficulty: CampaignDifficulty;
  useTicket?: boolean;
}): Promise<CampaignBattleResult> {
  const res = await fetch(`/api/campaigns/${encodeURIComponent(input.campaignId)}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress: input.walletAddress,
      deck: input.deck,
      difficulty: input.difficulty,
      useTicket: input.useTicket ?? false,
    }),
  });
  const data = (await res.json()) as CampaignBattleResult | { error?: string };
  if (!res.ok) {
    throw new Error("error" in data && data.error ? data.error : "Campaign battle failed");
  }
  return data as CampaignBattleResult;
}

export async function startCampaignRun(input: {
  campaignId: string;
  walletAddress: string;
  deck: GameCard[];
  difficulty: CampaignDifficulty;
  useTicket?: boolean;
}): Promise<CampaignRunState> {
  const res = await fetch(`/api/campaigns/${encodeURIComponent(input.campaignId)}/runs/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as CampaignRunState | { error?: string };
  if (!res.ok) throw new Error("error" in data && data.error ? data.error : "Could not start campaign run");
  return data as CampaignRunState;
}

export async function pickCampaignCard(input: {
  runId: string;
  walletAddress: string;
  assetId: string;
}): Promise<CampaignRunState> {
  const res = await fetch(`/api/campaigns/runs/${encodeURIComponent(input.runId)}/pick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress: input.walletAddress,
      assetId: input.assetId,
    }),
  });
  const data = (await res.json()) as CampaignRunState | { error?: string };
  if (!res.ok) throw new Error("error" in data && data.error ? data.error : "Could not play card");
  return data as CampaignRunState;
}

export async function continueCampaignRun(input: {
  runId: string;
  walletAddress: string;
}): Promise<CampaignRunState> {
  const res = await fetch(`/api/campaigns/runs/${encodeURIComponent(input.runId)}/next`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: input.walletAddress }),
  });
  const data = (await res.json()) as CampaignRunState | { error?: string };
  if (!res.ok) throw new Error("error" in data && data.error ? data.error : "Could not continue run");
  return data as CampaignRunState;
}

export async function exitCampaignRun(input: {
  runId: string;
  walletAddress: string;
}): Promise<void> {
  const res = await fetch(`/api/campaigns/runs/${encodeURIComponent(input.runId)}/exit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: input.walletAddress }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Could not exit run");
}

export async function creatorDepositRewards(campaignId: string, rewardCount: number): Promise<{ rewardPool: number }> {
  const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rewardCount }),
  });
  const data = (await res.json()) as { error?: string; rewardPool?: number };
  if (!res.ok) throw new Error(data.error ?? "Deposit failed");
  return { rewardPool: data.rewardPool ?? 0 };
}
