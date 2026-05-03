import crypto from "node:crypto";
import { PublicKey } from "@solana/web3.js";

const DEFAULT_PROGRAM_ID = "11111111111111111111111111111111";

export type ChainIntent = {
  mode: "onchain";
  action: "publish_campaign" | "pay_entry" | "finalize_run" | "claim_reward";
  programId: string;
  campaignPda: string;
  rewardVaultPda: string;
  feeVaultPda: string;
  memo: string;
  commitmentHash?: string;
  nonce?: number;
};

function getProgramId(): PublicKey {
  const raw = process.env.CAMPAIGN_PROGRAM_ID?.trim() || DEFAULT_PROGRAM_ID;
  try {
    return new PublicKey(raw);
  } catch {
    return new PublicKey(DEFAULT_PROGRAM_ID);
  }
}

function derivePda(seed: string, campaignId: string, programId: PublicKey): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(seed, "utf8"), Buffer.from(campaignId, "utf8")],
    programId
  );
  return pda.toBase58();
}

export function isOnchainCampaignsEnabled(): boolean {
  return String(process.env.ONCHAIN_CAMPAIGNS_ENABLED || "").toLowerCase() === "true";
}

export function deriveCampaignAccounts(campaignId: string) {
  const programId = getProgramId();
  return {
    programId: programId.toBase58(),
    campaignPda: derivePda("campaign", campaignId, programId),
    rewardVaultPda: derivePda("reward-vault", campaignId, programId),
    feeVaultPda: derivePda("fee-vault", campaignId, programId),
  };
}

function buildMemo(action: string, payload: Record<string, unknown>): string {
  return JSON.stringify({
    app: "drip-royale",
    module: "campaigns",
    action,
    ts: Date.now(),
    ...payload,
  });
}

export function buildPublishIntent(input: {
  campaignId: string;
  creatorWallet: string;
  linkedCollectionMint?: string | null;
}): ChainIntent {
  const accounts = deriveCampaignAccounts(input.campaignId);
  return {
    mode: "onchain",
    action: "publish_campaign",
    ...accounts,
    memo: buildMemo("publish_campaign", {
      campaignId: input.campaignId,
      creatorWallet: input.creatorWallet,
      linkedCollectionMint: input.linkedCollectionMint ?? null,
    }),
  };
}

export function buildEntryIntent(input: {
  campaignId: string;
  wallet: string;
  amount: number;
  entryId: string;
}): ChainIntent {
  const accounts = deriveCampaignAccounts(input.campaignId);
  return {
    mode: "onchain",
    action: "pay_entry",
    ...accounts,
    memo: buildMemo("pay_entry", {
      campaignId: input.campaignId,
      wallet: input.wallet,
      amount: input.amount,
      entryId: input.entryId,
    }),
  };
}

export function createRunCommitmentHash(input: {
  runId: string;
  campaignId: string;
  wallet: string;
  difficulty: string;
  deckAssetIds: string[];
}): { commitmentHash: string; nonce: number } {
  const nonce = Date.now();
  const digest = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        runId: input.runId,
        campaignId: input.campaignId,
        wallet: input.wallet,
        difficulty: input.difficulty,
        deckAssetIds: [...input.deckAssetIds].sort(),
        nonce,
      })
    )
    .digest("hex");
  return { commitmentHash: digest, nonce };
}

export function buildFinalizeIntent(input: {
  campaignId: string;
  runId: string;
  wallet: string;
  commitmentHash: string;
  nonce: number;
}): ChainIntent {
  const accounts = deriveCampaignAccounts(input.campaignId);
  return {
    mode: "onchain",
    action: "finalize_run",
    ...accounts,
    commitmentHash: input.commitmentHash,
    nonce: input.nonce,
    memo: buildMemo("finalize_run", input),
  };
}

export function buildClaimIntent(input: {
  campaignId: string;
  runId: string;
  wallet: string;
  rewardType: "royale" | "cnft" | "hybrid";
}): ChainIntent {
  const accounts = deriveCampaignAccounts(input.campaignId);
  return {
    mode: "onchain",
    action: "claim_reward",
    ...accounts,
    memo: buildMemo("claim_reward", input),
  };
}
