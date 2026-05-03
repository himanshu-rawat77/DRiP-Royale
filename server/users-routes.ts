import express, { Router } from "express";
import { nanoid } from "nanoid";
import { dbQuery } from "./db";
import { bootstrapCollectionNft, bootstrapMerkleTree } from "./campaign-collection-bootstrap";

type UserRole = "player" | "creator";

function normalizeWallet(wallet?: string): string {
  return (wallet ?? "").trim();
}

function readQueryLimit(req: any, fallback: number): number {
  const expressLimit = req?.query?.limit;
  if (expressLimit !== undefined) {
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

export function createUsersRouter(): Router {
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

  r.get("/:wallet", async (req, res) => {
    const wallet = normalizeWallet(req.params.wallet);
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    const out = await dbQuery<{ wallet: string; role: UserRole | null; username: string | null }>(
      `select wallet, role, username from users where wallet = $1`,
      [wallet]
    );
    const row = out.rows[0] ?? null;
    return sendJson(res, 200, {
      wallet,
      role: row?.role ?? null,
      username: row?.username ?? null,
      isNew: !row,
    });
  });

  r.post("/:wallet/role", async (req, res) => {
    const wallet = normalizeWallet(req.params.wallet);
    const body = req.body as { role?: UserRole; username?: string };
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    if (body.role !== "player" && body.role !== "creator") {
      return sendJson(res, 400, { error: "role must be player or creator" });
    }
    const username = body.username?.trim() || null;
    const out = await dbQuery<{ wallet: string; role: UserRole; username: string | null }>(
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
    const wallet = normalizeWallet(req.params.wallet);
    const limitRaw = readQueryLimit(req, 50);
    const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });

    const out = await dbQuery<{
      id: number;
      external_match_id: string | null;
      opponent: string;
      result: "WIN" | "LOSS";
      reward: string;
      nfts_won: string[];
      mode: string;
      created_at: string;
    }>(
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
      createdAt: row.created_at,
    }));

    const wins = entries.filter((e) => e.result === "WIN").length;
    const losses = entries.filter((e) => e.result === "LOSS").length;
    const total = wins + losses;
    const winRate = total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0;

    return sendJson(res, 200, { wallet, entries, stats: { wins, losses, total, winRate } });
  });

  r.post("/matches", async (req, res) => {
    const body = req.body as {
      wallet?: string;
      externalMatchId?: string;
      opponent?: string;
      result?: "WIN" | "LOSS";
      reward?: string;
      nftsWon?: string[];
      mode?: string;
    };
    const wallet = normalizeWallet(body.wallet);
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
    const wallet = normalizeWallet(req.params.wallet);
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });

    const campaignsOut = await dbQuery<{ count: string }>(
      `select count(*)::text as count from creator_campaigns where creator_wallet = $1`,
      [wallet]
    );
    const collectionsOut = await dbQuery<{ count: string }>(
      `select count(*)::text as count from creator_collections where creator_wallet = $1`,
      [wallet]
    );
    const earningsOut = await dbQuery<{ total_royale: number; by_campaign: Record<string, number> }>(
      `select total_royale, by_campaign from creator_earnings where creator = $1`,
      [wallet]
    );
    const earnings = earningsOut.rows[0] ?? { total_royale: 0, by_campaign: {} };

    return sendJson(res, 200, {
      wallet,
      stats: {
        campaigns: Number(campaignsOut.rows[0]?.count ?? 0),
        collections: Number(collectionsOut.rows[0]?.count ?? 0),
        totalEarnings: earnings.total_royale,
      },
      byCampaign: earnings.by_campaign ?? {},
    });
  });

  r.get("/creator/:wallet/campaigns", async (req, res) => {
    const wallet = normalizeWallet(req.params.wallet);
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    const out = await dbQuery<{
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
    }>(
      `select * from creator_campaigns where creator_wallet = $1 order by created_at desc`,
      [wallet]
    );
    return sendJson(res, 200, { campaigns: out.rows });
  });

  r.post("/creator/:wallet/campaigns", async (req, res) => {
    const wallet = normalizeWallet(req.params.wallet);
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    const body = req.body as {
      name?: string;
      theme?: string;
      minDeckSize?: number;
      entryTicketCost?: number;
      rewardPool?: number;
      baseRoyaleReward?: number;
      prizePreview?: string;
      status?: string;
      config?: Record<string, unknown>;
      linkedCollectionId?: string;
    };
    const name = body.name?.trim();
    const theme = body.theme?.trim();
    if (!name || !theme) return sendJson(res, 400, { error: "name and theme are required" });

    const linkedCollectionId = body.linkedCollectionId?.trim() || undefined;
    if (linkedCollectionId) {
      const linked = await dbQuery<{ id: string }>(
        `select id from creator_collections where id = $1 and creator_wallet = $2`,
        [linkedCollectionId, wallet]
      );
      if (!linked.rows[0]) return sendJson(res, 400, { error: "linkedCollectionId not found for this creator" });
    }

    const mergedConfig = {
      ...(body.config ?? {}),
      ...(linkedCollectionId ? { linkedCollectionId } : {}),
    };

    const id = `creator-${nanoid(10)}`;
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
        JSON.stringify(mergedConfig),
      ]
    );
    return sendJson(res, 200, { ok: true, id });
  });

  r.get("/creator/:wallet/collections", async (req, res) => {
    const wallet = normalizeWallet(req.params.wallet);
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    const out = await dbQuery<{
      id: string;
      name: string;
      symbol: string | null;
      description: string | null;
      supply: number;
      status: string;
      metadata_json: Record<string, unknown>;
      created_at: string;
    }>(
      `select * from creator_collections where creator_wallet = $1 order by created_at desc`,
      [wallet]
    );
    return sendJson(res, 200, { collections: out.rows });
  });

  r.post("/creator/:wallet/collections", async (req, res) => {
    const wallet = normalizeWallet(req.params.wallet);
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    const body = req.body as {
      name?: string;
      symbol?: string;
      description?: string;
      supply?: number;
      status?: string;
      metadata?: Record<string, unknown>;
      imageUri?: string;
      externalUrl?: string;
      collectionMetadataUri?: string;
      feePercent?: number;
      collectionMint?: string;
      mintingRules?: Record<string, unknown>;
      metadataTemplate?: Record<string, unknown>;
      verificationSignerRef?: string;
      merkleTree?: string;
    };
    const name = body.name?.trim();
    if (!name) return sendJson(res, 400, { error: "name is required" });
    const metadata = {
      ...(body.metadata ?? {}),
      imageUri: body.imageUri?.trim() || null,
      externalUrl: body.externalUrl?.trim() || null,
      collectionMetadataUri: body.collectionMetadataUri?.trim() || null,
      feePercent: typeof body.feePercent === "number" ? body.feePercent : null,
      collectionMint: body.collectionMint?.trim() || null,
      mintingRules: body.mintingRules ?? null,
      metadataTemplate: body.metadataTemplate ?? null,
      verificationSignerRef: body.verificationSignerRef?.trim() || null,
      merkleTree: body.merkleTree?.trim() || null,
      chainStatus: body.collectionMint ? "configured" : "draft",
    };

    const id = `collection-${nanoid(10)}`;
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
        JSON.stringify(metadata),
      ]
    );
    return sendJson(res, 200, { ok: true, id });
  });

  r.post("/creator/:wallet/collections/:collectionId/mint/prepare", async (req, res) => {
    const wallet = normalizeWallet(req.params.wallet);
    const collectionId = req.params.collectionId?.trim();
    if (!wallet || !collectionId) return sendJson(res, 400, { error: "wallet and collectionId are required" });

    const collectionOut = await dbQuery<{ id: string; name: string; metadata_json: Record<string, unknown> }>(
      `select id, name, metadata_json from creator_collections where id = $1 and creator_wallet = $2`,
      [collectionId, wallet]
    );
    const collection = collectionOut.rows[0];
    if (!collection) return sendJson(res, 404, { error: "Collection not found" });

    const body = req.body as {
      recipientWallet?: string;
      itemName?: string;
      itemUri?: string;
      attributes?: Array<{ trait_type: string; value: string }>;
    };
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
        attributes: body.attributes ?? [],
      },
      notes: [
        "This endpoint prepares mint intent for server signer flow.",
        "Next integration: execute mint + collection verification with backend signer.",
      ],
    });
  });

  r.post("/creator/:wallet/collections/:collectionId/bootstrap/collection", async (req, res) => {
    const wallet = normalizeWallet(req.params.wallet);
    const collectionId = req.params.collectionId?.trim();
    if (!wallet || !collectionId) return sendJson(res, 400, { error: "wallet and collectionId are required" });
    const out = await dbQuery<{ id: string; name: string; symbol: string | null; metadata_json: Record<string, unknown> }>(
      `select id, name, symbol, metadata_json from creator_collections where id = $1 and creator_wallet = $2`,
      [collectionId, wallet]
    );
    const row = out.rows[0];
    if (!row) return sendJson(res, 404, { error: "Collection not found" });
    const body = req.body as {
      metadataUri?: string;
      name?: string;
      symbol?: string;
      feePercent?: number;
      imageUri?: string;
      externalUrl?: string;
      description?: string;
    };
    const metadataUri =
      body.metadataUri?.trim() ||
      (typeof row.metadata_json?.collectionMetadataUri === "string" && row.metadata_json.collectionMetadataUri.trim()) ||
      (typeof row.metadata_json?.metadataUri === "string" && row.metadata_json.metadataUri.trim()) ||
      null;
    if (!metadataUri) {
      return sendJson(res, 400, {
        error: "metadata uri missing. Set collectionMetadataUri/metadataUri in collection metadata first.",
      });
    }
    const minted = await bootstrapCollectionNft({
      name: body.name?.trim() || row.name,
      symbol: body.symbol?.trim() || row.symbol,
      metadataUri,
      sellerFeePercent: body.feePercent ?? 0,
    });
    const nextMetadata = {
      ...(row.metadata_json ?? {}),
      collectionMetadataUri: metadataUri,
      imageUri: body.imageUri?.trim() || row.metadata_json?.imageUri || null,
      externalUrl: body.externalUrl?.trim() || row.metadata_json?.externalUrl || null,
      description: body.description?.trim() || row.metadata_json?.description || null,
      collectionMint: minted.collectionMint,
      collectionCreateTx: minted.txSignature,
      chainStatus: "collection_created",
    };
    await dbQuery(
      `update creator_collections set metadata_json = $2::jsonb, updated_at = now() where id = $1`,
      [collectionId, JSON.stringify(nextMetadata)]
    );
    return sendJson(res, 200, { ok: true, collectionMint: minted.collectionMint, txSignature: minted.txSignature });
  });

  r.post("/creator/:wallet/collections/:collectionId/bootstrap/merkle", async (req, res) => {
    const wallet = normalizeWallet(req.params.wallet);
    const collectionId = req.params.collectionId?.trim();
    if (!wallet || !collectionId) return sendJson(res, 400, { error: "wallet and collectionId are required" });
    const out = await dbQuery<{ id: string; metadata_json: Record<string, unknown> }>(
      `select id, metadata_json from creator_collections where id = $1 and creator_wallet = $2`,
      [collectionId, wallet]
    );
    const row = out.rows[0];
    if (!row) return sendJson(res, 404, { error: "Collection not found" });
    const body = req.body as { maxDepth?: number; maxBufferSize?: number };
    const created = await bootstrapMerkleTree({
      maxDepth: body.maxDepth,
      maxBufferSize: body.maxBufferSize,
    });
    const nextMetadata = {
      ...(row.metadata_json ?? {}),
      merkleTree: created.merkleTree,
      merkleCreateTx: created.txSignature,
      chainStatus: "merkle_created",
    };
    await dbQuery(
      `update creator_collections set metadata_json = $2::jsonb, updated_at = now() where id = $1`,
      [collectionId, JSON.stringify(nextMetadata)]
    );
    return sendJson(res, 200, { ok: true, merkleTree: created.merkleTree, txSignature: created.txSignature });
  });

  r.get("/creator/:wallet/campaigns/:campaignId/stage-rewards", async (req, res) => {
    const wallet = normalizeWallet(req.params.wallet);
    const campaignId = req.params.campaignId?.trim();
    if (!wallet || !campaignId) return sendJson(res, 400, { error: "wallet and campaignId are required" });
    const own = await dbQuery<{ id: string }>(
      `select id from creator_campaigns where id = $1 and creator_wallet = $2`,
      [campaignId, wallet]
    );
    if (!own.rows[0]) return sendJson(res, 404, { error: "Campaign not found for this creator" });
    const out = await dbQuery<{
      stage_index: number;
      reward_name: string;
      metadata_uri: string;
      image_uri: string | null;
      rarity: string | null;
      supply_cap: number | null;
      status: string;
    }>(
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
    const wallet = normalizeWallet(req.params.wallet);
    const campaignId = req.params.campaignId?.trim();
    if (!wallet || !campaignId) return sendJson(res, 400, { error: "wallet and campaignId are required" });
    const own = await dbQuery<{ id: string }>(
      `select id from creator_campaigns where id = $1 and creator_wallet = $2`,
      [campaignId, wallet]
    );
    if (!own.rows[0]) return sendJson(res, 404, { error: "Campaign not found for this creator" });

    const body = req.body as {
      rewards?: Array<{
        stageIndex: number;
        rewardName: string;
        metadataUri: string;
        imageUri?: string;
        rarity?: string;
        supplyCap?: number;
        status?: string;
      }>;
    };
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
          rwd.status?.trim() || "active",
        ]
      );
    }
    return sendJson(res, 200, { ok: true });
  });

  r.post("/creator/:wallet/campaigns/:campaignId/publish-live", async (req, res) => {
    const wallet = normalizeWallet(req.params.wallet);
    const campaignId = req.params.campaignId?.trim();
    if (!wallet || !campaignId) return sendJson(res, 400, { error: "wallet and campaignId are required" });
    const campaignOut = await dbQuery<{ id: string; config_json: Record<string, unknown> }>(
      `select id, config_json from creator_campaigns where id = $1 and creator_wallet = $2`,
      [campaignId, wallet]
    );
    const campaign = campaignOut.rows[0];
    if (!campaign) return sendJson(res, 404, { error: "Campaign not found for this creator" });
    const linkedCollectionId =
      typeof campaign.config_json?.linkedCollectionId === "string" ? campaign.config_json.linkedCollectionId : null;
    if (!linkedCollectionId) return sendJson(res, 400, { error: "Link a collection before publishing" });
    const colOut = await dbQuery<{ metadata_json: Record<string, unknown> }>(
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
    const rewards = await dbQuery<{ count: string }>(
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
    const wallet = normalizeWallet(req.params.wallet);
    if (!wallet) return sendJson(res, 400, { error: "wallet is required" });
    const body = req.body as {
      campaignName?: string;
      campaignTheme?: string;
      entryTicketCost?: number;
      baseRoyaleReward?: number;
      collectionName?: string;
      collectionSymbol?: string;
      supply?: number;
      collectionMetadataUri?: string;
      collectionImageUri?: string;
      collectionExternalUrl?: string;
      feePercent?: number;
      merkleMaxDepth?: number;
      merkleMaxBufferSize?: number;
    };
    const campaignName = body.campaignName?.trim();
    const campaignTheme = body.campaignTheme?.trim();
    const collectionName = body.collectionName?.trim();
    const collectionMetadataUri = body.collectionMetadataUri?.trim();
    const supply = Math.max(0, Math.floor(body.supply ?? 0));
    if (!campaignName || !campaignTheme || !collectionName || !collectionMetadataUri) {
      return sendJson(res, 400, {
        error: "campaignName, campaignTheme, collectionName and collectionMetadataUri are required",
      });
    }

    const collectionId = `collection-${nanoid(10)}`;
    const campaignId = `creator-${nanoid(10)}`;
    const collectionCreate = await bootstrapCollectionNft({
      name: collectionName,
      symbol: body.collectionSymbol?.trim() || "DRIP",
      metadataUri: collectionMetadataUri,
      sellerFeePercent: body.feePercent ?? 0,
    });
    const merkleCreate = await bootstrapMerkleTree({
      maxDepth: body.merkleMaxDepth,
      maxBufferSize: body.merkleMaxBufferSize,
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
          chainStatus: "ready",
        }),
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
        JSON.stringify({ linkedCollectionId: collectionId }),
      ]
    );

    return sendJson(res, 200, {
      ok: true,
      campaignId,
      collectionId,
      collectionMint: collectionCreate.collectionMint,
      merkleTree: merkleCreate.merkleTree,
      txs: { collectionCreate: collectionCreate.txSignature, merkleCreate: merkleCreate.txSignature },
    });
  });

  return r;
}
