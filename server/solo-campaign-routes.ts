import express, { Router } from "express";
import { type GameCard, type LocalMatch, initializeLocalMatch, submitPick } from "../shared/matchEngine";
import { dbQuery } from "./db";
import {
  addChallengeTickets,
  consumeChallengeTicket,
  distributeRoyale,
  getChallengeTickets,
  getRoyaleBalance,
  spendRoyale,
} from "./tokenomics-store";
import {
  buildClaimIntent,
  buildEntryIntent,
  buildFinalizeIntent,
  buildPublishIntent,
  createRunCommitmentHash,
  deriveCampaignAccounts,
  isOnchainCampaignsEnabled,
} from "./onchain-campaign";
import { mintStageRewardCnft } from "./campaign-reward-mint";

type Difficulty = "normal" | "hard" | "nightmare";
type RunStatus = "in_progress" | "stage_won" | "lost" | "completed";
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
  stageIndex: number;
  status: RunStatus;
  match: LocalMatch | null;
  prompt: string | null;
  allFlawless: boolean;
  rewardGranted: boolean;
  royaleReward: number;
};
type Campaign = {
  id: string;
  name: string;
  theme: string;
  creator: string;
  minDeckSize: number;
  rewardPool: number;
  baseRoyaleReward: number;
  entryTicketCost: number;
  prizePreview: string;
  linkedCollectionId?: string;
  linkedCollectionName?: string;
  linkedCollectionMint?: string | null;
};

const campaigns: Campaign[] = [
  { id: "mvp-training", name: "MVP Training Grounds", theme: "Simulation Sandbox", creator: "DRiP System", minDeckSize: 3, rewardPool: 999, baseRoyaleReward: 8, entryTicketCost: 2, prizePreview: "Training Relic cNFT" },
  { id: "neon-citadel", name: "Neon Citadel", theme: "Cyber Landmark", creator: "DRiP Creator Alpha", minDeckSize: 5, rewardPool: 120, baseRoyaleReward: 12, entryTicketCost: 5, prizePreview: "Neon Crown (Rare cNFT)" },
  { id: "void-gallery", name: "Void Gallery", theme: "Abstract Void", creator: "DRiP Creator Sigma", minDeckSize: 5, rewardPool: 90, baseRoyaleReward: 15, entryTicketCost: 8, prizePreview: "Void Curator Key (Epic cNFT)" },
];

async function listAllCampaigns(): Promise<Campaign[]> {
  const creatorRows = await dbQuery<{
    id: string;
    creator_wallet: string;
    name: string;
    theme: string;
    min_deck_size: number;
    reward_pool: number;
    base_royale_reward: number;
    entry_ticket_cost: number;
    prize_preview: string;
    status: string;
    config_json: Record<string, unknown>;
  }>(
    `select id, creator_wallet, name, theme, min_deck_size, reward_pool, base_royale_reward, entry_ticket_cost, prize_preview, status, config_json
     from creator_campaigns
     where status = 'published'
     order by created_at desc`
  );

  const linkedIds = creatorRows.rows
    .map((row) => (typeof row.config_json?.linkedCollectionId === "string" ? row.config_json.linkedCollectionId : null))
    .filter((v): v is string => !!v);

  const collectionById = new Map<string, { id: string; name: string; metadata_json: Record<string, unknown> }>();
  if (linkedIds.length > 0) {
    const collections = await dbQuery<{ id: string; name: string; metadata_json: Record<string, unknown> }>(
      `select id, name, metadata_json from creator_collections where id = any($1::text[])`,
      [linkedIds]
    );
    collections.rows.forEach((row) => collectionById.set(row.id, row));
  }

  const creatorCampaigns: Campaign[] = creatorRows.rows.map((row) => {
    const linkedCollectionId =
      typeof row.config_json?.linkedCollectionId === "string" ? row.config_json.linkedCollectionId : undefined;
    const linked = linkedCollectionId ? collectionById.get(linkedCollectionId) : undefined;
    const linkedCollectionMint =
      linked && typeof linked.metadata_json?.collectionMint === "string" ? linked.metadata_json.collectionMint : null;
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
      linkedCollectionMint,
    };
  });

  return [...campaigns, ...creatorCampaigns];
}

const STAGES = ["Match 1", "Match 2", "Match 3", "Boss"] as const;
const ENTRY_SPLIT = { creator: 50, rewardPool: 35, protocol: 15 } as const;

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
function difficultyPowerBand(difficulty: Difficulty, stageIndex: number): { min: number; max: number; boostChance: number } {
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
    const boosted = Math.random() < band.boostChance ? Math.max(scaled, randomBandPower) : Math.round((scaled + randomBandPower) / 2);
    const floorByDifficulty = difficulty === "nightmare" ? (stageIndex >= 2 ? 9 : 8) : difficulty === "hard" ? 6 : 4;
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
function splitEntry(amount: number) {
  const creator = Math.floor((amount * ENTRY_SPLIT.creator) / 100);
  const rewardPool = Math.floor((amount * ENTRY_SPLIT.rewardPool) / 100);
  const protocol = Math.max(0, amount - creator - rewardPool);
  return { creator, rewardPool, protocol };
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

async function upsertProgress(wallet: string, campaignId: string, progress: Progress): Promise<void> {
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

async function getProgress(wallet: string, campaignId: string): Promise<Progress> {
  const out = await dbQuery<{
    completed_chapters: number;
    wins: number;
    losses: number;
    best_difficulty: Difficulty | null;
    claimed_rewards: number;
  }>(`select * from campaign_progress where wallet=$1 and campaign_id=$2`, [wallet, campaignId]);
  const row = out.rows[0];
  if (!row) {
    return { completedChapters: 0, wins: 0, losses: 0, bestDifficulty: null, claimedRewards: 0 };
  }
  return {
    completedChapters: row.completed_chapters,
    wins: row.wins,
    losses: row.losses,
    bestDifficulty: row.best_difficulty,
    claimedRewards: row.claimed_rewards,
  };
}

async function saveRun(run: CampaignRun): Promise<void> {
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
      JSON.stringify(run.match),
    ]
  );
}

async function getRun(runId: string): Promise<CampaignRun | null> {
  const out = await dbQuery<{
    run_id: string;
    wallet: string;
    campaign_id: string;
    difficulty: Difficulty;
    stage_index: number;
    status: RunStatus;
    prompt: string | null;
    all_flawless: boolean;
    reward_granted: boolean;
    royale_reward: number;
    deck_json: GameCard[];
    match_json: LocalMatch | null;
  }>(`select * from campaign_runs where run_id=$1`, [runId]);
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
    deck: (row.deck_json as unknown as GameCard[]) ?? [],
    match: (row.match_json as unknown as LocalMatch | null) ?? null,
  };
}

async function removeRun(runId: string): Promise<void> {
  await dbQuery(`delete from campaign_runs where run_id=$1`, [runId]);
}

async function getRunChainState(runId: string) {
  const out = await dbQuery<{
    run_id: string;
    commitment_hash: string;
    nonce: string;
    status: string;
    finalize_signature: string | null;
    claim_signature: string | null;
  }>(
    `select run_id, commitment_hash, nonce::text, status, finalize_signature, claim_signature
     from campaign_run_chain where run_id = $1`,
    [runId]
  );
  return out.rows[0] ?? null;
}

async function getCampaignChainState(campaignId: string) {
  const out = await dbQuery<{
    campaign_id: string;
    chain_mode: string;
    program_id: string | null;
    campaign_pda: string | null;
    reward_vault_pda: string | null;
    fee_vault_pda: string | null;
    publish_signature: string | null;
    status: string;
  }>(
    `select campaign_id, chain_mode, program_id, campaign_pda, reward_vault_pda, fee_vault_pda, publish_signature, status
     from campaign_chain_state where campaign_id = $1`,
    [campaignId]
  );
  return out.rows[0] ?? null;
}

async function runResponse(run: CampaignRun, campaign: Campaign) {
  const chainRun = await getRunChainState(run.runId);
  const chainCampaign = await getCampaignChainState(campaign.id);
  const rewardsOut = await dbQuery<{
    stage_index: number;
    reward_name: string;
    metadata_uri: string;
    mint_tx: string;
    minted_asset_id: string | null;
    created_at: string;
  }>(
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
      claimSignature: chainRun?.claim_signature ?? null,
    },
    mintedRewards: rewardsOut.rows.map((r) => ({
      stageIndex: r.stage_index,
      rewardName: r.reward_name,
      metadataUri: r.metadata_uri,
      mintTx: r.mint_tx,
      mintedAssetId: r.minted_asset_id,
      createdAt: r.created_at,
    })),
  };
}

async function updateProgressOnStageResult(run: CampaignRun, campaign: Campaign) {
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

async function mintStageRewardForStageWin(run: CampaignRun, campaign: Campaign, stageIndex: number): Promise<void> {
  if (!campaign.id.startsWith("creator-")) return;
  const existing = await dbQuery<{ id: number }>(
    `select id from campaign_run_rewards where run_id = $1 and stage_index = $2`,
    [run.runId, stageIndex]
  );
  if (existing.rows[0]) return;

  const stageCfg = await dbQuery<{
    reward_name: string;
    metadata_uri: string;
    status: string;
  }>(
    `
    select reward_name, metadata_uri, status
    from campaign_stage_rewards
    where campaign_id = $1 and stage_index = $2
    `,
    [campaign.id, stageIndex]
  );
  const reward = stageCfg.rows[0];
  if (!reward || reward.status !== "active") return;

  const collection = await dbQuery<{ metadata_json: Record<string, unknown> }>(
    `
    select cc.metadata_json
    from creator_campaigns cp
    join creator_collections cc on cc.id = (cp.config_json->>'linkedCollectionId')
    where cp.id = $1
    `,
    [campaign.id]
  );
  const metadataJson = collection.rows[0]?.metadata_json;
  const collectionMint =
    metadataJson && typeof metadataJson.collectionMint === "string" ? metadataJson.collectionMint : null;
  const merkleTree =
    metadataJson && typeof metadataJson.merkleTree === "string" ? metadataJson.merkleTree : null;
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
      creators: [{ address: campaign.creator, verified: false, share: 100 }],
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

export function createSoloCampaignRouter(): Router {
  const r = Router();
  r.use(express.json({ limit: "512kb" }));
  const sendJson = (res: any, status: number, payload: any) => {
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
    const out = await dbQuery<{ total_royale: number; by_campaign: Record<string, number> }>(
      `select total_royale, by_campaign from creator_earnings where creator = $1`,
      [creator]
    );
    const row = out.rows[0] ?? { total_royale: 0, by_campaign: {} };
    return sendJson(res, 200, { creator, totalRoyale: row.total_royale, byCampaign: row.by_campaign });
  });

  r.get("/progress/:wallet", async (req, res) => {
    const wallet = req.params.wallet;
    const rows = await dbQuery<{
      campaign_id: string;
      completed_chapters: number;
      wins: number;
      losses: number;
      best_difficulty: Difficulty | null;
      claimed_rewards: number;
    }>(`select * from campaign_progress where wallet = $1`, [wallet]);
    const byCampaign = new Map(rows.rows.map((r) => [r.campaign_id, r]));
    const allCampaigns = await listAllCampaigns();
    const progress = allCampaigns.map((campaign) => {
      const row = byCampaign.get(campaign.id);
      return {
        campaignId: campaign.id,
        completedChapters: row?.completed_chapters ?? 0,
        wins: row?.wins ?? 0,
        losses: row?.losses ?? 0,
        bestDifficulty: row?.best_difficulty ?? null,
        claimedRewards: row?.claimed_rewards ?? 0,
      };
    });
    return sendJson(res, 200, {
      wallet,
      progress,
      royaleBalance: await getRoyaleBalance(wallet),
      challengeTickets: await getChallengeTickets(wallet),
    });
  });

  r.post("/:campaignId/deposit", async (req, res) => {
    const allCampaigns = await listAllCampaigns();
    const campaign = allCampaigns.find((c) => c.id === req.params.campaignId);
    if (!campaign) return sendJson(res, 404, { error: "Campaign not found" });
    const rewardCount = Math.max(1, Math.floor((req.body as { rewardCount?: number }).rewardCount ?? 1));
    if (campaign.id.startsWith("creator-")) {
      const out = await dbQuery<{ reward_pool: number }>(
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
    const wallet = (req.body as { walletAddress?: string } | undefined)?.walletAddress?.trim();
    const balance = wallet ? await getRoyaleBalance(wallet) : undefined;
    return sendJson(res, 200, {
      campaignId: campaign.id,
      amount,
      split,
      splitPct: ENTRY_SPLIT,
      royaleBalance: balance,
      canAfford: wallet ? (balance ?? 0) >= amount : undefined,
    });
  });

  r.post("/:campaignId/entry/commit", async (req, res) => {
    const allCampaigns = await listAllCampaigns();
    const campaign = allCampaigns.find((c) => c.id === req.params.campaignId);
    if (!campaign) return sendJson(res, 404, { error: "Campaign not found" });
    const wallet = (req.body as { walletAddress?: string }).walletAddress?.trim();
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

    const chainIntent =
      isOnchainCampaignsEnabled() && campaign.id.startsWith("creator-")
        ? buildEntryIntent({
            campaignId: campaign.id,
            wallet,
            amount,
            entryId,
          })
        : null;

    return sendJson(res, 200, {
      ok: true,
      entryId,
      campaignId: campaign.id,
      amount,
      split,
      royaleBalance: await getRoyaleBalance(wallet),
      challengeTickets: await getChallengeTickets(wallet),
      onchain: chainIntent,
    });
  });

  r.post("/:campaignId/runs/start", async (req, res) => {
    const allCampaigns = await listAllCampaigns();
    const campaign = allCampaigns.find((c) => c.id === req.params.campaignId);
    if (!campaign) return sendJson(res, 404, { error: "Campaign not found" });
    const body = req.body as { walletAddress?: string; deck?: GameCard[]; difficulty?: Difficulty; useTicket?: boolean; entryId?: string };
    const wallet = body.walletAddress?.trim();
    if (!wallet) return sendJson(res, 400, { error: "walletAddress is required" });
    const deck = Array.isArray(body.deck) ? body.deck : [];
    if (deck.length < campaign.minDeckSize) return sendJson(res, 400, { error: `Minimum deck size is ${campaign.minDeckSize}` });
    const difficulty: Difficulty = body.difficulty === "hard" || body.difficulty === "nightmare" ? body.difficulty : "normal";

    const entryCost = Math.max(0, Math.floor(campaign.entryTicketCost));
    if (entryCost > 0) {
      const entryId = body.entryId?.trim();
      if (!entryId) return sendJson(res, 400, { error: "entryId is required for this campaign" });
      const entry = await dbQuery<{ wallet: string; campaign_id: string; status: string }>(`select wallet, campaign_id, status from campaign_entries where entry_id=$1`, [entryId]);
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
    await saveRun(run);
    if (isOnchainCampaignsEnabled() && campaign.id.startsWith("creator-")) {
      const { commitmentHash, nonce } = createRunCommitmentHash({
        runId,
        campaignId: campaign.id,
        wallet,
        difficulty,
        deckAssetIds: run.deck.map((d) => d.assetId),
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
    const creatorWallet = (req.body as { creatorWallet?: string })?.creatorWallet?.trim();
    if (!creatorWallet) return sendJson(res, 400, { error: "creatorWallet is required" });
    const intent = buildPublishIntent({
      campaignId: campaign.id,
      creatorWallet,
      linkedCollectionMint: campaign.linkedCollectionMint ?? null,
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
    const body = req.body as { creatorWallet?: string; signature?: string };
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
    const body = req.body as { walletAddress?: string; signature?: string };
    if (!body.walletAddress?.trim() || !body.signature?.trim()) {
      return sendJson(res, 400, { error: "walletAddress and signature are required" });
    }
    const entry = await dbQuery<{ wallet: string; campaign_id: string }>(
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
    const body = req.body as { walletAddress?: string; chainSignature?: string };
    if (!body.walletAddress || body.walletAddress !== run.wallet) return sendJson(res, 403, { error: "wallet mismatch" });
    const chain = await getRunChainState(run.runId);
    if (!chain) return sendJson(res, 400, { error: "Run commitment missing. Start run again." });
    const intent = buildFinalizeIntent({
      campaignId: campaign.id,
      runId: run.runId,
      wallet: run.wallet,
      commitmentHash: chain.commitment_hash,
      nonce: Number(chain.nonce),
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
    const body = req.body as { walletAddress?: string; chainSignature?: string };
    if (!body.walletAddress || body.walletAddress !== run.wallet) return sendJson(res, 403, { error: "wallet mismatch" });
    if (run.status !== "completed") return sendJson(res, 400, { error: "Run not completed" });
    const intent = buildClaimIntent({
      campaignId: campaign.id,
      runId: run.runId,
      wallet: run.wallet,
      rewardType: campaign.linkedCollectionMint ? "hybrid" : "royale",
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
    const body = req.body as { walletAddress?: string; stage?: "finalize" | "claim"; signature?: string };
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
    const body = req.body as { walletAddress?: string; assetId?: string };
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
    const body = req.body as { walletAddress?: string };
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
    const body = req.body as { walletAddress?: string };
    if (!body.walletAddress || body.walletAddress !== run.wallet) return sendJson(res, 403, { error: "wallet mismatch" });
    await removeRun(run.runId);
    return sendJson(res, 200, { ok: true });
  });

  return r;
}
