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
  prizePreview?: string;
  linkedCollectionId?: string;
  linkedCollectionName?: string;
  linkedCollectionMint?: string | null;
}

export interface CampaignEntryPreview {
  campaignId: string;
  amount: number;
  split: { creator: number; rewardPool: number; protocol: number };
  splitPct: { creator: number; rewardPool: number; protocol: number };
  royaleBalance?: number;
  canAfford?: boolean;
}

export interface CampaignEntryCommitResult {
  ok: boolean;
  entryId: string;
  campaignId: string;
  amount: number;
  split: { creator: number; rewardPool: number; protocol: number };
  royaleBalance: number;
  challengeTickets: number;
}

export interface CreatorEarningsResponse {
  creator: string;
  totalRoyale: number;
  byCampaign: Record<string, number>;
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
  mintedRewards?: Array<{
    stageIndex: number;
    rewardName: string;
    metadataUri: string;
    mintTx: string;
    mintedAssetId: string | null;
    createdAt: string;
  }>;
  onchain?: {
    enabled: boolean;
    chainMode: string;
    campaignStatus: string;
    runStatus: string | null;
    finalizedSignature: string | null;
    claimSignature: string | null;
  };
}

export interface ChainIntent {
  mode: "onchain";
  action: "publish_campaign" | "pay_entry" | "finalize_run" | "claim_reward";
  programId: string;
  campaignPda: string;
  rewardVaultPda: string;
  feeVaultPda: string;
  memo: string;
  commitmentHash?: string;
  nonce?: number;
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
  entryId?: string;
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

export async function previewCampaignEntry(input: {
  campaignId: string;
  walletAddress: string;
}): Promise<CampaignEntryPreview> {
  const res = await fetch(`/api/campaigns/${encodeURIComponent(input.campaignId)}/entry/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: input.walletAddress }),
  });
  const data = (await res.json()) as CampaignEntryPreview | { error?: string };
  if (!res.ok) throw new Error("error" in data && data.error ? data.error : "Could not preview entry");
  return data as CampaignEntryPreview;
}

export async function commitCampaignEntry(input: {
  campaignId: string;
  walletAddress: string;
}): Promise<CampaignEntryCommitResult & { onchain?: ChainIntent | null }> {
  const res = await fetch(`/api/campaigns/${encodeURIComponent(input.campaignId)}/entry/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: input.walletAddress }),
  });
  const data = (await res.json()) as CampaignEntryCommitResult | { error?: string };
  if (!res.ok) throw new Error("error" in data && data.error ? data.error : "Could not commit entry");
  return data as CampaignEntryCommitResult;
}

export async function fetchCampaignPublishIntent(input: {
  campaignId: string;
  creatorWallet: string;
}): Promise<{ ok: true; intent: ChainIntent }> {
  const res = await fetch(`/api/campaigns/${encodeURIComponent(input.campaignId)}/onchain/publish-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creatorWallet: input.creatorWallet }),
  });
  const data = (await res.json()) as { ok?: true; intent?: ChainIntent; error?: string };
  if (!res.ok || !data.intent) throw new Error(data.error ?? "Could not prepare publish intent");
  return { ok: true, intent: data.intent };
}

export async function confirmCampaignPublish(input: {
  campaignId: string;
  creatorWallet: string;
  signature: string;
}): Promise<{ ok: true; status: "published"; signature: string }> {
  const res = await fetch(`/api/campaigns/${encodeURIComponent(input.campaignId)}/onchain/publish-confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { ok?: true; status?: "published"; signature?: string; error?: string };
  if (!res.ok || data.status !== "published" || !data.signature) {
    throw new Error(data.error ?? "Could not confirm publish signature");
  }
  return { ok: true, status: "published", signature: data.signature };
}

export async function fetchFinalizeRunIntent(input: {
  runId: string;
  walletAddress: string;
  chainSignature?: string;
}): Promise<{ ok: true; intent: ChainIntent }> {
  const res = await fetch(`/api/campaigns/runs/${encodeURIComponent(input.runId)}/onchain/finalize-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { ok?: true; intent?: ChainIntent; error?: string };
  if (!res.ok || !data.intent) throw new Error(data.error ?? "Could not prepare finalize intent");
  return { ok: true, intent: data.intent };
}

export async function fetchClaimRunIntent(input: {
  runId: string;
  walletAddress: string;
  chainSignature?: string;
}): Promise<{ ok: true; intent: ChainIntent }> {
  const res = await fetch(`/api/campaigns/runs/${encodeURIComponent(input.runId)}/onchain/claim-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { ok?: true; intent?: ChainIntent; error?: string };
  if (!res.ok || !data.intent) throw new Error(data.error ?? "Could not prepare claim intent");
  return { ok: true, intent: data.intent };
}

export async function confirmRunOnchain(input: {
  runId: string;
  walletAddress: string;
  stage: "finalize" | "claim";
  signature: string;
}): Promise<{ ok: true; status: "finalized" | "claimed" }> {
  const res = await fetch(`/api/campaigns/runs/${encodeURIComponent(input.runId)}/onchain/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { ok?: true; status?: "finalized" | "claimed"; error?: string };
  if (!res.ok || !data.status) throw new Error(data.error ?? "Could not confirm on-chain stage");
  return { ok: true, status: data.status };
}

export async function confirmEntryOnchain(input: {
  entryId: string;
  walletAddress: string;
  signature: string;
}): Promise<{ ok: true; status: "paid"; signature: string }> {
  const res = await fetch(`/api/campaigns/entries/${encodeURIComponent(input.entryId)}/onchain/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { ok?: true; status?: "paid"; signature?: string; error?: string };
  if (!res.ok || data.status !== "paid" || !data.signature) {
    throw new Error(data.error ?? "Could not confirm entry payment");
  }
  return { ok: true, status: "paid", signature: data.signature };
}

export async function fetchCreatorEarnings(creator: string): Promise<CreatorEarningsResponse> {
  const res = await fetch(`/api/campaigns/creators/${encodeURIComponent(creator)}/earnings`);
  const data = (await res.json()) as CreatorEarningsResponse | { error?: string };
  if (!res.ok) throw new Error("error" in data && data.error ? data.error : "Could not load creator earnings");
  return data as CreatorEarningsResponse;
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
