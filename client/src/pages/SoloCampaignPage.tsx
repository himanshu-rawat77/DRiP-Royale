import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import { usePhantomWallet } from "@/contexts/PhantomWalletContext";
import { useHeliusAssets } from "@/hooks/useHeliusAssets";
import {
  creatorDepositRewards,
  fetchCampaignProgress,
  fetchCampaigns,
  type CampaignDifficulty,
  type CampaignSummary,
} from "@/lib/soloCampaignClient";
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
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [difficulty, setDifficulty] = useState<CampaignDifficulty>("normal");
  const [tickets, setTickets] = useState(0);
  const [royaleBalance, setRoyaleBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  const activeCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaign) ?? null,
    [campaigns, selectedCampaign]
  );

  useEffect(() => {
    void (async () => {
      try {
        const next = await fetchCampaigns();
        setCampaigns(next);
        if (next.length > 0) setSelectedCampaign(next[0].id);
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

  const deckForCampaign: GameCard[] = useMemo(() => {
    const base = assets.slice(0, 8);
    if (activeCampaign?.id === "mvp-training" && base.length < 3) {
      return buildDummyDeck(5);
    }
    return base;
  }, [assets, activeCampaign?.id]);

  const runBattle = async () => {
    if (!publicKey || !activeCampaign) return;
    if (deckForCampaign.length < activeCampaign.minDeckSize) {
      toast.error(`Select at least ${activeCampaign.minDeckSize} DRiP cards in your deck.`);
      return;
    }
    writeCampaignSession({
      campaignId: activeCampaign.id,
      difficulty,
    });
    navigate("/vault");
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
    if (!activeCampaign) return;
    try {
      const out = await creatorDepositRewards(activeCampaign.id, 10);
      setCampaigns((prev) =>
        prev.map((c) => (c.id === activeCampaign.id ? { ...c, rewardPool: out.rewardPool } : c))
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
            <img src={BG} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: "brightness(0.25) saturate(0.2)" }} />
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
                Phase 3/4 flow: campaign progression, creator reward pools, and ROYALE earn/spend loop.
              </p>
            </motion.div>

            {!publicKey ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 drip-panel p-6">
                  <p className="text-xs mb-4" style={{ color: "#A78BFA", fontFamily: "'IBM Plex Mono', monospace" }}>
                    CAMPAIGN REGISTRY (PREVIEW)
                  </p>
                  <div className="space-y-4">
                    {campaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        className="w-full text-left rounded-lg p-4 border"
                        style={{
                          borderColor: selectedCampaign === campaign.id ? "rgba(245,158,11,0.4)" : "rgba(139,92,246,0.2)",
                          background: selectedCampaign === campaign.id ? "rgba(245,158,11,0.08)" : "rgba(139,92,246,0.06)",
                        }}
                      >
                        <p style={{ color: "#FFFFFF", fontFamily: "'Syne', sans-serif" }}>{campaign.name}</p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                          {campaign.theme} · Reward Pool: {campaign.rewardPool} cNFT
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="drip-panel p-6">
                  <p className="text-sm mb-4" style={{ color: "#FFFFFF" }}>
                    Connect Phantom to enter solo campaigns.
                  </p>
                  <button
                    onClick={() => void connect()}
                    disabled={!isPhantomAvailable || connecting}
                    className="px-4 py-2 rounded-lg font-bold text-xs w-full"
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
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 drip-panel p-6">
                  <p className="text-xs mb-4" style={{ color: "#A78BFA", fontFamily: "'IBM Plex Mono', monospace" }}>
                    CAMPAIGN REGISTRY
                  </p>
                  <div className="space-y-4">
                    {campaigns.map((campaign) => (
                      <button
                        key={campaign.id}
                        onClick={() => setSelectedCampaign(campaign.id)}
                        className="w-full text-left rounded-lg p-4 border"
                        style={{
                          borderColor: selectedCampaign === campaign.id ? "rgba(245,158,11,0.4)" : "rgba(139,92,246,0.2)",
                          background: selectedCampaign === campaign.id ? "rgba(245,158,11,0.08)" : "rgba(139,92,246,0.06)",
                        }}
                      >
                        <p style={{ color: "#FFFFFF", fontFamily: "'Syne', sans-serif" }}>{campaign.name}</p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                          {campaign.theme} · Reward Pool: {campaign.rewardPool} cNFT
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="drip-panel-hot p-6">
                  <p className="text-xs mb-4" style={{ color: "#F59E0B", fontFamily: "'IBM Plex Mono', monospace" }}>
                    ROYALE ECONOMY
                  </p>
                  <p className="text-sm mb-2" style={{ color: "#FFFFFF" }}>
                    Balance: {royaleBalance} ROYALE
                  </p>
                  <p className="text-sm mb-4" style={{ color: "#FFFFFF" }}>
                    Tickets: {tickets}
                  </p>
                  <button
                    onClick={() => void buyTicket()}
                    className="w-full px-3 py-2 rounded-lg text-xs font-bold mb-3"
                    style={{ background: "rgba(139,92,246,0.18)", color: "#A78BFA" }}
                  >
                    BUY 1 TICKET (5 ROYALE)
                  </button>
                  <button
                    onClick={() => void creatorTopUp()}
                    className="w-full px-3 py-2 rounded-lg text-xs font-bold"
                    style={{ background: "rgba(245,158,11,0.18)", color: "#F59E0B" }}
                  >
                    CREATOR TOP-UP +10 cNFT
                  </button>
                </div>
              </div>
            )}

            {publicKey && activeCampaign && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="drip-panel p-6 mt-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm" style={{ color: "#FFFFFF" }}>
                      Active: {activeCampaign.name}
                    </p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                      Next: deck build in Vault, then staged Arena flow (1 → 2 → 3 → Boss).
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(["normal", "hard", "nightmare"] as CampaignDifficulty[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className="px-3 py-2 rounded-lg text-xs font-bold"
                        style={{
                          background: difficulty === d ? "rgba(139,92,246,0.3)" : "rgba(139,92,246,0.1)",
                          color: difficulty === d ? "#F59E0B" : "#A78BFA",
                        }}
                      >
                        {d.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => void runBattle()}
                  disabled={loading}
                  className="mt-4 px-6 py-3 rounded-lg text-xs font-bold"
                  style={{
                    background: "linear-gradient(135deg, #8B5CF6, #A78BFA)",
                    color: "#FFFFFF",
                    opacity: loading ? 0.65 : 1,
                  }}
                >
                  {loading ? "PREPARING…" : "ENTER CAMPAIGN VAULT"}
                </button>
              </motion.div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
