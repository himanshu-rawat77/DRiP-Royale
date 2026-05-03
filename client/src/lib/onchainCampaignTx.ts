import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { getHeliusRpcUrl } from "@shared/heliusRpc";
import { getPhantomProvider } from "./phantomWallet";
import type { ChainIntent } from "./soloCampaignClient";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

function clientHeliusRpcUrl(): string {
  const env = import.meta.env;
  return getHeliusRpcUrl({
    apiKey:
      (env.VITE_HELIUS_API_KEY as string | undefined) ||
      (env.NEXT_PUBLIC_HELIUS_API_KEY as string | undefined),
    network:
      (env.VITE_SOLANA_NETWORK as string | undefined) ||
      (env.NEXT_PUBLIC_SOLANA_NETWORK as string | undefined),
  });
}

export async function sendCampaignIntentTransaction(
  walletAddress: string,
  intent: ChainIntent
): Promise<string> {
  const provider = getPhantomProvider();
  if (!provider?.signTransaction) throw new Error("Wallet cannot sign transaction");
  const connection = new Connection(clientHeliusRpcUrl(), "confirmed");
  const owner = new PublicKey(walletAddress);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: owner,
    recentBlockhash: blockhash,
  });

  const feeVault = new PublicKey(intent.feeVaultPda);
  tx.add(
    SystemProgram.transfer({
      fromPubkey: owner,
      toPubkey: feeVault,
      lamports: 0,
    })
  );
  tx.add(
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [
        { pubkey: owner, isSigner: true, isWritable: false },
        { pubkey: new PublicKey(intent.campaignPda), isSigner: false, isWritable: false },
        { pubkey: new PublicKey(intent.rewardVaultPda), isSigner: false, isWritable: false },
        { pubkey: feeVault, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(intent.memo, "utf8"),
    })
  );

  const signed = (await provider.signTransaction(tx)) as Transaction;
  const sig = await connection.sendRawTransaction(signed.serialize(), { maxRetries: 3 });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}
