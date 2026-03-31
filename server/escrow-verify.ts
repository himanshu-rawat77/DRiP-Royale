export type DasAssetResult = {
  ownership?: { owner?: string };
  compression?: { compressed?: boolean; data_hash?: string };
};

export async function dasGetAsset(rpcUrl: string, assetId: string): Promise<DasAssetResult | null> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "escrow-verify",
      method: "getAsset",
      params: { id: assetId },
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: DasAssetResult; error?: { message?: string } };
  if (data.error?.message) throw new Error(data.error.message);
  return data.result ?? null;
}

export function isCompressedNft(asset: DasAssetResult | null): boolean {
  if (!asset?.compression) return false;
  if (asset.compression.compressed === true) return true;
  return !!asset.compression.data_hash;
}

export async function verifyCompressedAssetsInCustody(
  rpcUrl: string,
  custodyPubkey: string,
  assetIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const id of assetIds) {
    try {
      const asset = await dasGetAsset(rpcUrl, id);
      if (!asset) {
        return { ok: false, error: `Asset not found: ${id}` };
      }
      if (!isCompressedNft(asset)) {
        return {
          ok: false,
          error: `Escrow supports compressed NFTs only. Asset ${id} is not compressed.`,
        };
      }
      const owner = asset.ownership?.owner;
      if (owner !== custodyPubkey) {
        return {
          ok: false,
          error: `Asset ${id} is not in custody (expected ${custodyPubkey}, got ${owner ?? "none"}).`,
        };
      }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : `Verification failed for ${id}`,
      };
    }
  }
  return { ok: true };
}
