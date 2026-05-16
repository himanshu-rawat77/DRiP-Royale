export type UserRole = "player" | "creator";

export interface UserRecord {
  wallet: string;
  role: UserRole | null;
  username: string | null;
  isNew: boolean;
}

export interface MatchHistoryEntry {
  id: string;
  externalMatchId: string | null;
  opponent: string;
  result: "WIN" | "LOSS";
  reward: string;
  nftsWon: WonNft[];
  mode: string;
  date: string;
  createdAt: string;
}

export interface WonNft {
  assetId: string;
  name?: string;
  imageUri?: string;
  power?: number;
  metadataUri?: string;
}

export interface MatchHistoryResponse {
  wallet: string;
  entries: MatchHistoryEntry[];
  stats: {
    wins: number;
    losses: number;
    total: number;
    winRate: number;
  };
}

export interface CreatorDashboardResponse {
  wallet: string;
  stats: { campaigns: number; collections: number; totalEarnings: number };
  byCampaign: Record<string, number>;
}

export interface CreatorCampaignRow {
  id: string;
  name: string;
  theme: string;
  min_deck_size: number;
  entry_ticket_cost: number;
  reward_pool: number;
  base_royale_reward: number;
  prize_preview: string;
  status: string;
  config_json: Record<string, unknown>;
  created_at: string;
}

export interface CampaignStageRewardRow {
  stage_index: number;
  reward_name: string;
  metadata_uri: string;
  image_uri: string | null;
  rarity: string | null;
  supply_cap: number | null;
  status: string;
}

export interface CreatorCollectionRow {
  id: string;
  name: string;
  symbol: string | null;
  description: string | null;
  supply: number;
  status: string;
  metadata_json?: Record<string, unknown>;
  created_at: string;
}

export async function fetchUserRecord(wallet: string): Promise<UserRecord> {
  const res = await fetch(`/api/users/${encodeURIComponent(wallet)}`);
  if (!res.ok) throw new Error("Failed to load user");
  return res.json() as Promise<UserRecord>;
}

export async function setUserRole(wallet: string, role: UserRole, username?: string): Promise<UserRecord> {
  const res = await fetch(`/api/users/${encodeURIComponent(wallet)}/role`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, username }),
  });
  const data = (await res.json()) as UserRecord | { error?: string };
  if (!res.ok) throw new Error("error" in data && data.error ? data.error : "Failed to set role");
  return data as UserRecord;
}

export async function updateUserProfile(wallet: string, input: { username?: string }): Promise<UserRecord> {
  const res = await fetch(`/api/users/${encodeURIComponent(wallet)}/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as UserRecord | { error?: string };
  if (!res.ok) throw new Error("error" in data && data.error ? data.error : "Failed to update profile");
  return data as UserRecord;
}

export async function fetchMatchHistory(wallet: string): Promise<MatchHistoryResponse> {
  const res = await fetch(`/api/users/${encodeURIComponent(wallet)}/history`);
  if (!res.ok) throw new Error("Failed to load history");
  return res.json() as Promise<MatchHistoryResponse>;
}

export async function recordMatchHistory(input: {
  wallet: string;
  externalMatchId?: string;
  opponent: string;
  result: "WIN" | "LOSS";
  reward: string;
  nftsWon?: WonNft[];
  mode?: string;
}): Promise<void> {
  const res = await fetch("/api/users/matches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to save match");
}

export async function fetchCreatorDashboard(wallet: string): Promise<CreatorDashboardResponse> {
  const res = await fetch(`/api/users/creator/${encodeURIComponent(wallet)}/dashboard`);
  if (!res.ok) throw new Error("Failed to load creator dashboard");
  return res.json() as Promise<CreatorDashboardResponse>;
}

export async function fetchCreatorCampaigns(wallet: string): Promise<CreatorCampaignRow[]> {
  const res = await fetch(`/api/users/creator/${encodeURIComponent(wallet)}/campaigns`);
  const data = (await res.json()) as { campaigns: CreatorCampaignRow[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to load creator campaigns");
  return data.campaigns;
}

export async function createCreatorCampaign(
  wallet: string,
  input: {
    name: string;
    theme: string;
    minDeckSize: number;
    entryTicketCost: number;
    rewardPool: number;
    baseRoyaleReward: number;
    prizePreview?: string;
    linkedCollectionId?: string;
  }
): Promise<{ ok: boolean; id: string }> {
  const res = await fetch(`/api/users/creator/${encodeURIComponent(wallet)}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
  if (!res.ok || !data.id) throw new Error(data.error ?? "Failed to create campaign");
  return { ok: true, id: data.id };
}

export async function fetchCreatorCollections(wallet: string): Promise<CreatorCollectionRow[]> {
  const res = await fetch(`/api/users/creator/${encodeURIComponent(wallet)}/collections`);
  const data = (await res.json()) as { collections: CreatorCollectionRow[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to load collections");
  return data.collections;
}

export async function createCreatorCollection(
  wallet: string,
  input: {
    name: string;
    symbol?: string;
    description?: string;
    supply: number;
    imageUri?: string;
    collectionMint?: string;
    mintingRules?: Record<string, unknown>;
    metadataTemplate?: Record<string, unknown>;
    verificationSignerRef?: string;
    merkleTree?: string;
  }
): Promise<{ ok: boolean; id: string }> {
  const res = await fetch(`/api/users/creator/${encodeURIComponent(wallet)}/collections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
  if (!res.ok || !data.id) throw new Error(data.error ?? "Failed to create collection");
  return { ok: true, id: data.id };
}

export async function bootstrapCollectionOnchain(
  wallet: string,
  collectionId: string,
  input?: {
    metadataUri?: string;
    name?: string;
    symbol?: string;
    feePercent?: number;
    imageUri?: string;
    externalUrl?: string;
    description?: string;
  }
): Promise<{ ok: boolean; collectionMint: string; txSignature: string }> {
  const res = await fetch(
    `/api/users/creator/${encodeURIComponent(wallet)}/collections/${encodeURIComponent(collectionId)}/bootstrap/collection`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    }
  );
  const data = (await res.json()) as {
    ok?: boolean;
    collectionMint?: string;
    txSignature?: string;
    error?: string;
  };
  if (!res.ok || !data.ok || !data.collectionMint || !data.txSignature) {
    throw new Error(data.error ?? "Failed to bootstrap collection");
  }
  return { ok: true, collectionMint: data.collectionMint, txSignature: data.txSignature };
}

export async function bootstrapMerkleTreeOnchain(
  wallet: string,
  collectionId: string,
  input?: { maxDepth?: number; maxBufferSize?: number }
): Promise<{ ok: boolean; merkleTree: string; txSignature: string }> {
  const res = await fetch(
    `/api/users/creator/${encodeURIComponent(wallet)}/collections/${encodeURIComponent(collectionId)}/bootstrap/merkle`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    }
  );
  const data = (await res.json()) as {
    ok?: boolean;
    merkleTree?: string;
    txSignature?: string;
    error?: string;
  };
  if (!res.ok || !data.ok || !data.merkleTree || !data.txSignature) {
    throw new Error(data.error ?? "Failed to bootstrap merkle tree");
  }
  return { ok: true, merkleTree: data.merkleTree, txSignature: data.txSignature };
}

export async function fetchCampaignStageRewards(
  wallet: string,
  campaignId: string
): Promise<CampaignStageRewardRow[]> {
  const res = await fetch(
    `/api/users/creator/${encodeURIComponent(wallet)}/campaigns/${encodeURIComponent(campaignId)}/stage-rewards`
  );
  const data = (await res.json()) as { rewards?: CampaignStageRewardRow[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to load stage rewards");
  return data.rewards ?? [];
}

export async function saveCampaignStageRewards(
  wallet: string,
  campaignId: string,
  rewards: Array<{
    stageIndex: number;
    rewardName: string;
    metadataUri: string;
    imageUri?: string;
    rarity?: string;
    supplyCap?: number;
    status?: string;
  }>
): Promise<void> {
  const res = await fetch(
    `/api/users/creator/${encodeURIComponent(wallet)}/campaigns/${encodeURIComponent(campaignId)}/stage-rewards`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rewards }),
    }
  );
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save stage rewards");
}

export async function publishCampaignLive(wallet: string, campaignId: string): Promise<void> {
  const res = await fetch(
    `/api/users/creator/${encodeURIComponent(wallet)}/campaigns/${encodeURIComponent(campaignId)}/publish-live`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not publish campaign");
}

export async function launchCampaignWithOnchainCollection(input: {
  wallet: string;
  campaignName: string;
  campaignTheme: string;
  entryTicketCost: number;
  baseRoyaleReward: number;
  collectionName: string;
  collectionSymbol?: string;
  supply?: number;
  collectionMetadataUri: string;
  collectionImageUri?: string;
  collectionExternalUrl?: string;
  feePercent?: number;
}): Promise<{
  campaignId: string;
  collectionId: string;
  collectionMint: string;
  merkleTree: string;
}> {
  const { wallet, ...payload } = input;
  const res = await fetch(`/api/users/creator/${encodeURIComponent(wallet)}/launch-campaign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    campaignId?: string;
    collectionId?: string;
    collectionMint?: string;
    merkleTree?: string;
    error?: string;
  };
  if (!res.ok || !data.ok || !data.campaignId || !data.collectionId || !data.collectionMint || !data.merkleTree) {
    throw new Error(data.error ?? "Could not launch campaign flow");
  }
  return {
    campaignId: data.campaignId,
    collectionId: data.collectionId,
    collectionMint: data.collectionMint,
    merkleTree: data.merkleTree,
  };
}

export async function prepareCollectionMint(
  wallet: string,
  collectionId: string,
  input: {
    recipientWallet: string;
    itemName?: string;
    itemUri?: string;
    attributes?: Array<{ trait_type: string; value: string }>;
  }
): Promise<{ ok: boolean; type: string; notes: string[] }> {
  const res = await fetch(
    `/api/users/creator/${encodeURIComponent(wallet)}/collections/${encodeURIComponent(collectionId)}/mint/prepare`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  const data = (await res.json()) as { ok?: boolean; type?: string; notes?: string[]; error?: string };
  if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to prepare mint");
  return { ok: true, type: data.type ?? "prepared_mint_request", notes: data.notes ?? [] };
}
