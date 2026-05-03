import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import { usePhantomWallet } from "@/contexts/PhantomWalletContext";
import { useHeliusAssets } from "@/hooks/useHeliusAssets";
import {
  confirmEntryOnchain,
  commitCampaignEntry,
  creatorDepositRewards,
  fetchCreatorEarnings,
  previewCampaignEntry,
  fetchCampaignProgress,
  fetchCampaigns,
  type CampaignDifficulty,
  type CampaignEntryPreview,
  type CampaignSummary,
} from "@/lib/soloCampaignClient";
import { sendCampaignIntentTransaction } from "@/lib/onchainCampaignTx";
import { purchaseChallengeTickets } from "@/lib/tokenomicsClient";
import { writeCampaignSession } from "@/lib/campaignSession";
import type { GameCard } from "@/lib/types";

const BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/arena-split-bg-By5zBsUSv6CrFLKpdTgQ8r.webp";

function buildDummyDeck(size: number = 5): GameCard[] {
  const out: GameCard[] = [];
  for (let i = 0; i < size; i++) {
    out.push({
      assetId: `dummy-${i + 1}`,
      name: `Training Card ${i + 1}`,
      imageUri:
        "https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/card-pattern-bg-By5zBsUSv6CrFLKpdTgQ8r.webp",
      power: 4 + (i % 4),
    });
  }
  return out;
}

export default function SoloCampaignPage() {
  const [, navigate] = useLocation();
  const { publicKey, connect, connecting, isPhantomAvailable } = usePhantomWallet();
  const { assets, loadAssets } = useHeliusAssets();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [difficultyByCampaign, setDifficultyByCampaign] = useState<Record<string, CampaignDifficulty>>({});
  const [tickets, setTickets] = useState(0);
  const [royaleBalance, setRoyaleBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [entryPreviewByCampaign, setEntryPreviewByCampaign] = useState<Record<string, CampaignEntryPreview>>({});
  const [creatorEarnedByCampaign, setCreatorEarnedByCampaign] = useState<Record<string, number>>({});

  useEffect(() => {
    void (async () => {
      try {
        const next = await fetchCampaigns();
        setCampaigns(next);
        setDifficultyByCampaign(
          next.reduce<Record<string, CampaignDifficulty>>((acc, c) => {
            acc[c.id] = "normal";
            return acc;
          }, {})
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load campaigns");
      }
    })();
  }, []);

  useEffect(() => {
    if (!publicKey) return;
    void loadAssets(publicKey, 52);
    void (async () => {
      try {
        const progress = await fetchCampaignProgress(publicKey);
        setRoyaleBalance(progress.royaleBalance);
        setTickets(progress.challengeTickets);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load progress");
      }
    })();
  }, [publicKey, loadAssets]);

  useEffect(() => {
    if (!publicKey || campaigns.length === 0) return;
    void (async () => {
      const previews: Record<string, CampaignEntryPreview> = {};
      const creatorTotals: Record<string, number> = {};

      await Promise.all(
        campaigns.map(async (campaign) => {
          try {
            const [preview, earnings] = await Promise.all([
              previewCampaignEntry({ campaignId: campaign.id, walletAddress: publicKey }),
              fetchCreatorEarnings(campaign.creator),
            ]);
            previews[campaign.id] = preview;
            creatorTotals[campaign.id] = earnings.byCampaign[campaign.id] ?? 0;
          } catch {
            // Best-effort load per card.
          }
        })
      );

      setEntryPreviewByCampaign(previews);
      setCreatorEarnedByCampaign(creatorTotals);
    })();
  }, [publicKey, campaigns]);

  const getDeckForCampaign = useMemo(() => {
    const base = assets.slice(0, 8);
    return (campaignId: string): GameCard[] => {
      if (campaignId === "mvp-training" && base.length < 3) {
        return buildDummyDeck(5);
      }
      return base;
    };
  }, [assets]);

  const runBattle = async (campaign: CampaignSummary) => {
    if (!publicKey) return;
    const deck = getDeckForCampaign(campaign.id);
    if (deck.length < campaign.minDeckSize) {
      toast.error(`Select at least ${campaign.minDeckSize} DRiP cards in your deck.`);
      return;
    }

    setLoading(true);
    try {
      const entry = await commitCampaignEntry({
        campaignId: campaign.id,
        walletAddress: publicKey,
      });
      if (entry.onchain) {
        const signature = await sendCampaignIntentTransaction(publicKey, entry.onchain);
        await confirmEntryOnchain({
          entryId: entry.entryId,
          walletAddress: publicKey,
          signature,
        });
      }
      setRoyaleBalance(entry.royaleBalance);
      writeCampaignSession({
        campaignId: campaign.id,
        difficulty: difficultyByCampaign[campaign.id] ?? "normal",
        entryId: entry.entryId,
      });
      // Clear stale multiplayer context so Arena stays in campaign flow.
      sessionStorage.removeItem("drip-multiplayer");
      if (entry.amount > 0) {
        toast.success(
          `Entry paid: ${entry.amount} ROYALE (Creator ${entry.split.creator}, Rewards ${entry.split.rewardPool}, Protocol ${entry.split.protocol})`
        );
      }
      navigate("/vault");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not commit campaign entry");
    } finally {
      setLoading(false);
    }
  };

  const buyTicket = async () => {
    if (!publicKey) return;
    try {
      const next = await purchaseChallengeTickets(publicKey, 1);
      setTickets(next.challengeTickets);
      setRoyaleBalance(next.royaleBalance);
      toast.success("Challenge ticket purchased");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not purchase ticket");
    }
  };

  const creatorTopUp = async () => {
    if (campaigns.length === 0) return;
    const firstCampaign = campaigns[0];
    try {
      const out = await creatorDepositRewards(firstCampaign.id, 10);
      setCampaigns((prev) =>
        prev.map((c) => (c.id === firstCampaign.id ? { ...c, rewardPool: out.rewardPool } : c))
      );
      toast.success("Creator reward pool topped up");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not top up reward pool");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <TopBar />
      <main className="flex-1">
        <section className="relative min-h-screen pt-28 pb-16 px-6 md:px-16" style={{ background: "#07060F" }}>
          <div className="absolute inset-0 z-0">
            <img
              src={BG}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: "brightness(0.25) saturate(0.2)" }}
            />
          </div>
          <div className="container relative z-10 max-w-6xl">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <p className="text-xs font-bold mb-2" style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#8B5CF6" }}>
                // SOLO CAMPAIGN
              </p>
              <h1 className="text-heading" style={{ fontSize: "2.5rem", color: "#FFFFFF" }}>
                Creator Boss Runs
              </h1>
              <p style={{ color: "rgba(255,255,255,0.55)" }}>
                Choose a campaign card, set difficulty, pay ROYALE entry fee, then enter Vault and continue into Arena progression.
              </p>
            </motion.div>

            {!publicKey && (
              <div className="drip-panel p-6 mb-6">
                <p className="text-sm mb-4" style={{ color: "#FFFFFF" }}>
                  Connect Phantom to enter solo campaigns.
                </p>
                <button
                  onClick={() => void connect()}
                  disabled={!isPhantomAvailable || connecting}
                  className="px-4 py-2 rounded-lg font-bold text-xs"
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    background: "linear-gradient(135deg, #8B5CF6, #A78BFA)",
                    color: "#FFFFFF",
                    opacity: !isPhantomAvailable || connecting ? 0.65 : 1,
                  }}
                >
                  {connecting ? "CONNECTING…" : "CONNECT PHANTOM"}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2 drip-panel-hot p-6">
                <p className="text-xs mb-4" style={{ color: "#F59E0B", fontFamily: "'IBM Plex Mono', monospace" }}>
                  ROYALE ECONOMY
                </p>
                <p className="text-sm mb-2" style={{ color: "#FFFFFF" }}>
                  Balance: {royaleBalance} ROYALE
                </p>
                <p className="text-sm mb-4" style={{ color: "#FFFFFF" }}>
                  Tickets: {tickets}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => void buyTicket()}
                    className="px-3 py-2 rounded-lg text-xs font-bold"
                    style={{ background: "rgba(139,92,246,0.18)", color: "#A78BFA" }}
                  >
                    BUY 1 TICKET (5 ROYALE)
                  </button>
                  <button
                    onClick={() => void creatorTopUp()}
                    className="px-3 py-2 rounded-lg text-xs font-bold"
                    style={{ background: "rgba(245,158,11,0.18)", color: "#F59E0B" }}
                  >
                    CREATOR TOP-UP +10 cNFT
                  </button>
                </div>
              </div>

              <div className="drip-panel p-6">
                <p className="text-xs mb-2" style={{ color: "#A78BFA", fontFamily: "'IBM Plex Mono', monospace" }}>
                  ENTRY SPLIT
                </p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Each entry fee split: Creator 50% · Reward Fund 35% · Protocol 15%.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {campaigns.map((campaign) => {
                const selectedDifficulty = difficultyByCampaign[campaign.id] ?? "normal";
                const preview = entryPreviewByCampaign[campaign.id];
                const creatorEarned = creatorEarnedByCampaign[campaign.id] ?? 0;
                const entryFee = preview?.amount ?? campaign.entryTicketCost;
                const split = preview?.split;
                return (
                  <motion.div
                    key={campaign.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="drip-panel p-5 border"
                    style={{ borderColor: "rgba(139,92,246,0.2)" }}
                  >
                    <p style={{ color: "#FFFFFF", fontFamily: "'Syne', sans-serif", fontSize: "1.05rem" }}>
                      {campaign.name}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                      {campaign.theme}
                    </p>
                    <p className="text-xs mt-2" style={{ color: "#A78BFA" }}>
                      Creator: {campaign.creator}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#FFFFFF" }}>
                      Entry Fee: {entryFee} ROYALE
                    </p>
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>
                      Prize: {campaign.prizePreview ?? `${campaign.rewardPool} cNFT pool`}
                    </p>
                    {campaign.linkedCollectionName && (
                      <p className="text-xs mt-1" style={{ color: "#10B981" }}>
                        Collection: {campaign.linkedCollectionName}
                        {campaign.linkedCollectionMint ? ` · Mint: ${campaign.linkedCollectionMint.slice(0, 6)}...${campaign.linkedCollectionMint.slice(-6)}` : ""}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: "#F59E0B" }}>
                      Creator earned: {creatorEarned} ROYALE
                    </p>
                    {split && (
                      <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                        Split C/R/P: {split.creator}/{split.rewardPool}/{split.protocol}
                      </p>
                    )}

                    <div className="flex gap-2 mt-4">
                      {(["normal", "hard", "nightmare"] as CampaignDifficulty[]).map((d) => (
                        <button
                          key={d}
                          onClick={() =>
                            setDifficultyByCampaign((prev) => ({
                              ...prev,
                              [campaign.id]: d,
                            }))
                          }
                          className="px-3 py-2 rounded-lg text-xs font-bold"
                          style={{
                            background: selectedDifficulty === d ? "rgba(139,92,246,0.3)" : "rgba(139,92,246,0.1)",
                            color: selectedDifficulty === d ? "#F59E0B" : "#A78BFA",
                          }}
                        >
                          {d.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => void runBattle(campaign)}
                      disabled={!publicKey || loading}
                      className="mt-4 px-5 py-2 rounded-lg text-xs font-bold"
                      style={{
                        background: "linear-gradient(135deg, #8B5CF6, #A78BFA)",
                        color: "#FFFFFF",
                        opacity: !publicKey || loading ? 0.65 : 1,
                      }}
                    >
                      {loading ? "PREPARING…" : "ENTER CAMPAIGN"}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
