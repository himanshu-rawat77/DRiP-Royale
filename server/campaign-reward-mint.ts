import { publicKey } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { signerIdentity, createSignerFromKeypair } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { mintToCollectionV1, mplBubblegum } from "@metaplex-foundation/mpl-bubblegum";
import bs58 from "bs58";
import { getCustodyKeypair } from "./custody-keypair";
import { getServerHeliusRpcUrl } from "./helius-rpc";

export type StageRewardMintInput = {
  recipientWallet: string;
  collectionMint: string;
  merkleTree: string;
  rewardName: string;
  metadataUri: string;
  creators?: Array<{ address: string; verified?: boolean; share: number }>;
};

export async function mintStageRewardCnft(input: StageRewardMintInput): Promise<{
  mintTx: string;
  mintedAssetId: string;
}> {
  const custody = getCustodyKeypair();
  if (!custody) throw new Error("CUSTODY_PRIVATE_KEY is required for stage reward minting");

  const umi = createUmi(getServerHeliusRpcUrl()).use(mplBubblegum());
  const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(custody));
  umi.use(signerIdentity(signer));

  const merkleTreePk = publicKey(input.merkleTree);
  const collectionMintPk = publicKey(input.collectionMint);
  const creatorList =
    input.creators && input.creators.length > 0
      ? input.creators.map((c) => ({
          address: publicKey(c.address),
          verified: Boolean(c.verified),
          share: c.share,
        }))
      : [{ address: signer.publicKey, verified: true, share: 100 }];

  const mint = await mintToCollectionV1(umi, {
    leafOwner: publicKey(input.recipientWallet),
    merkleTree: merkleTreePk,
    collectionMint: collectionMintPk,
    metadata: {
      name: input.rewardName,
      uri: input.metadataUri,
      sellerFeeBasisPoints: 0,
      collection: {
        key: collectionMintPk,
        verified: false,
      },
      creators: creatorList,
    },
  }).sendAndConfirm(umi);

  return {
    mintTx: bs58.encode(mint.signature),
    mintedAssetId: `${merkleTreePk.toString()}:${mintTxShort(bs58.encode(mint.signature))}`,
  };
}

function mintTxShort(sig: string): string {
  return sig.slice(0, 16);
}
