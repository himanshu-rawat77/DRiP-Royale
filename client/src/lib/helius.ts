/**
 * Helius DAS API – Asset Discovery (Phase 1)
 * getAssetsByOwner + filter by DRiP creator for verified collectibles
 */

import type { DASAsset } from "./types";
import type { GameCard } from "./types";
import { getHeliusRpcUrl as buildHeliusRpcUrl } from "@shared/heliusRpc";

const DEFAULT_DECK_LIMIT = 52;
const POWER_MIN = 2;
const POWER_MAX = 10;

function getHeliusRpcUrl(): string {
  const env = import.meta.env;
  const apiKey =
    (env.VITE_HELIUS_API_KEY as string | undefined) ||
    (env.NEXT_PUBLIC_HELIUS_API_KEY as string | undefined) ||
    "devnet";
  const network =
    (env.VITE_SOLANA_NETWORK as string | undefined) ||
    (env.NEXT_PUBLIC_SOLANA_NETWORK as string | undefined) ||
    "devnet";
  return buildHeliusRpcUrl({ apiKey, network });
}

export interface GetAssetsByOwnerParams {
  ownerAddress: string;
  page?: number;
  limit?: number;
}

export interface GetAssetsByOwnerResult {
  items: DASAsset[];
  total?: number;
  page?: number;
  limit?: number;
}

/**
 * Fetch all assets owned by wallet via Helius DAS getAssetsByOwner
 */
export async function getAssetsByOwner(
  params: GetAssetsByOwnerParams
): Promise<GetAssetsByOwnerResult> {
  const { ownerAddress, page = 1, limit = 1000 } = params;
  const rpcUrl = getHeliusRpcUrl();

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "drip-royale",
        method: "getAssetsByOwner",
        params: {
          ownerAddress,
          page,
          limit,
          options: {
            showUnverifiedCollections: true,
            showCollectionMetadata: true,
            showFungible: false,
            showNativeBalance: false,
          },
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Helius DAS request failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as {
      result?: { items?: DASAsset[]; total?: number; page?: number; limit?: number };
      error?: { message: string };
    };

    if (data.error) {
      throw new Error(data.error.message || "Helius DAS error");
    }

    const result = data.result ?? {};
    return {
      items: result.items ?? [],
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  } catch (error) {
    console.error("Helius API error:", error);
    throw error;
  }
}

/**
 * Filter assets by DRiP creator address (only verified DRiP collectibles)
 */
export function filterByDripCreator(
  items: DASAsset[],
  dripCreatorAddress: string | undefined
): DASAsset[] {
  if (!dripCreatorAddress) return items;
  const creatorLower = dripCreatorAddress.toLowerCase();
  return items.filter((asset) => {
    const creators = asset.creators ?? [];
    return creators.some(
      (c) => c.address.toLowerCase() === creatorLower && c.verified
    );
  });
}

/**
 * Map DAS asset to GameCard with power 2–10 (common scaling)
 */
export function assetToGameCard(asset: DASAsset, power?: number): GameCard {
  const content = asset.content as any;

  const imageUri =
    content?.links?.image ??
    content?.files?.[0]?.cdn_uri ??
    content?.files?.[0]?.uri ??
    content?.metadata?.image ??
    "";

  // Use provided power or generate random
  const cardPower = power ?? (POWER_MIN + Math.floor(Math.random() * (POWER_MAX - POWER_MIN + 1)));

  return {
    assetId: asset.id,
    imageUri,
    name: content?.metadata?.name ?? "Unknown DRiP",
    power: Math.max(POWER_MIN, Math.min(POWER_MAX, cardPower)),
  };
}

/**
 * Fetch wallet's DRiP assets and build cards for a deck.
 * Assigns random power 2–10 to each. Returns up to maxCards (default 52).
 */
export async function fetchDripAssetsForDeck(
  ownerAddress: string,
  maxCards: number = DEFAULT_DECK_LIMIT
): Promise<GameCard[]> {
  const dripCreator =
    (import.meta.env.VITE_DRIP_CREATOR_ADDRESS as string | undefined) ||
    (import.meta.env.NEXT_PUBLIC_DRIP_CREATOR_ADDRESS as string | undefined);
  const cap = Math.min(Math.max(1, maxCards), DEFAULT_DECK_LIMIT);
  const all: GameCard[] = [];
  let page = 1;
  const limit = 1000;

  try {
    while (all.length < cap) {
      const { items } = await getAssetsByOwner({ ownerAddress, page, limit });
      const dripOnly = filterByDripCreator(items, dripCreator);
      
      for (const asset of dripOnly) {
        if (all.length >= cap) break;
        const power = POWER_MIN + Math.floor(Math.random() * (POWER_MAX - POWER_MIN + 1));
        all.push(assetToGameCard(asset, power));
      }
      
      if (items.length < limit) break;
      page++;
    }

    return all.slice(0, cap);
  } catch (error) {
    console.error("Error fetching DRiP assets:", error);
    throw error;
  }
}

/**
 * Get asset metadata from Helius
 */
export async function getAssetMetadata(assetId: string): Promise<DASAsset | null> {
  const rpcUrl = getHeliusRpcUrl();

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "drip-royale",
        method: "getAsset",
        params: {
          id: assetId,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Helius getAsset failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      result?: DASAsset;
      error?: { message: string };
    };

    if (data.error) {
      throw new Error(data.error.message || "Helius error");
    }

    return data.result ?? null;
  } catch (error) {
    console.error("Error fetching asset metadata:", error);
    return null;
  }
}
