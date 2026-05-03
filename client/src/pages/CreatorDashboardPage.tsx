import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import Footer from "@/components/Footer";
import TopBar from "@/components/TopBar";
import { usePhantomWallet } from "@/contexts/PhantomWalletContext";
import { confirmCampaignPublish, fetchCampaignPublishIntent } from "@/lib/soloCampaignClient";
import { sendCampaignIntentTransaction } from "@/lib/onchainCampaignTx";
import {
  bootstrapCollectionOnchain,
  bootstrapMerkleTreeOnchain,
  createCreatorCampaign,
  createCreatorCollection,
  fetchCreatorCampaigns,
  fetchCreatorCollections,
  fetchCreatorDashboard,
  fetchUserRecord,
  fetchCampaignStageRewards,
  launchCampaignWithOnchainCollection,
  prepareCollectionMint,
  publishCampaignLive,
  saveCampaignStageRewards,
} from "@/lib/usersClient";

export default function CreatorDashboardPage() {
  const [, navigate] = useLocation();
  const { publicKey } = usePhantomWallet();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ campaigns: 0, collections: 0, totalEarnings: 0 });
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string; theme: string; status: string }>>([]);
  const [collections, setCollections] = useState<
    Array<{ id: string; name: string; supply: number; status: string; collectionMint?: string | null; merkleTree?: string | null }>
  >([]);

  const [campaignForm, setCampaignForm] = useState({
    name: "",
    theme: "",
    minDeckSize: 5,
    entryTicketCost: 5,
    rewardPool: 10,
    baseRoyaleReward: 10,
    linkedCollectionId: "",
  });
  const [launchForm, setLaunchForm] = useState({
    campaignName: "",
    campaignTheme: "",
    entryTicketCost: 0,
    baseRoyaleReward: 0,
    collectionName: "",
    collectionSymbol: "DRIP",
    supply: 100,
    collectionMetadataUri: "",
    collectionImageUri: "",
    collectionExternalUrl: "",
    feePercent: 0,
  });
  const [launchBusy, setLaunchBusy] = useState(false);
  const [collectionForm, setCollectionForm] = useState({
    name: "",
    symbol: "",
    description: "",
    supply: 100,
    imageUri: "",
    externalUrl: "",
    collectionMetadataUri: "",
    feePercent: 0,
    collectionMint: "",
    merkleTree: "",
  });
  const [stageRewardsCampaignId, setStageRewardsCampaignId] = useState("");
  const [stageRewards, setStageRewards] = useState<
    Array<{ stageIndex: number; rewardName: string; metadataUri: string; rarity: string }>
  >([
    { stageIndex: 0, rewardName: "Match 1 Reward", metadataUri: "", rarity: "common" },
    { stageIndex: 1, rewardName: "Match 2 Reward", metadataUri: "", rarity: "rare" },
    { stageIndex: 2, rewardName: "Match 3 Reward", metadataUri: "", rarity: "epic" },
    { stageIndex: 3, rewardName: "Boss Reward", metadataUri: "", rarity: "legendary" },
  ]);

  const loadAll = async (wallet: string) => {
    const [dash, campaignRows, collectionRows] = await Promise.all([
      fetchCreatorDashboard(wallet),
      fetchCreatorCampaigns(wallet),
      fetchCreatorCollections(wallet),
    ]);
    setStats(dash.stats);
    setCampaigns(campaignRows.map((c) => ({ id: c.id, name: c.name, theme: c.theme, status: c.status })));
    setCollections(
      collectionRows.map((c) => ({
        id: c.id,
        name: c.name,
        supply: c.supply,
        status: c.status,
        collectionMint:
          c.metadata_json && typeof c.metadata_json.collectionMint === "string" ? c.metadata_json.collectionMint : null,
        merkleTree: c.metadata_json && typeof c.metadata_json.merkleTree === "string" ? c.metadata_json.merkleTree : null,
      }))
    );
  };

  useEffect(() => {
    if (!publicKey) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const user = await fetchUserRecord(publicKey);
        if (user.role !== "creator") {
          toast.error("Switch your role to Creator from profile.");
          navigate("/profile");
          return;
        }
        await loadAll(publicKey);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load creator workspace");
      } finally {
        setLoading(false);
      }
    })();
  }, [publicKey, navigate]);

  const handleCreateCampaign = async () => {
    if (!publicKey) return;
    try {
      await createCreatorCampaign(publicKey, campaignForm);
      toast.success("Campaign draft created");
      await loadAll(publicKey);
      setCampaignForm((prev) => ({ ...prev, name: "", theme: "" }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create campaign failed");
    }
  };

  const handleCreateCollection = async () => {
    if (!publicKey) return;
    try {
      await createCreatorCollection(publicKey, collectionForm);
      toast.success("Collection draft created");
      await loadAll(publicKey);
      setCollectionForm({
        name: "",
        symbol: "",
        description: "",
        supply: 100,
        imageUri: "",
        externalUrl: "",
        collectionMetadataUri: "",
        feePercent: 0,
        collectionMint: "",
        merkleTree: "",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create collection failed");
    }
  };

  const handlePrepareMint = async () => {
    if (!publicKey || collections.length === 0) return;
    try {
      const first = collections[0];
      const out = await prepareCollectionMint(publicKey, first.id, {
        recipientWallet: publicKey,
        itemName: `${first.name} Reward #${Date.now().toString().slice(-4)}`,
      });
      toast.success(`Mint flow prepared (${out.type})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not prepare mint");
    }
  };

  const handlePublishOnchain = async (campaignId: string) => {
    if (!publicKey) return;
    try {
      const out = await fetchCampaignPublishIntent({ campaignId, creatorWallet: publicKey });
      const signature = await sendCampaignIntentTransaction(publicKey, out.intent);
      await confirmCampaignPublish({
        campaignId,
        creatorWallet: publicKey,
        signature,
      });
      toast.success(`On-chain publish submitted: ${signature.slice(0, 8)}...`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not prepare on-chain publish");
    }
  };

  const handleBootstrapCollection = async (collectionId: string) => {
    if (!publicKey) return;
    try {
      const out = await bootstrapCollectionOnchain(publicKey, collectionId, {
        metadataUri: collectionForm.collectionMetadataUri,
        name: collectionForm.name || undefined,
        symbol: collectionForm.symbol || undefined,
        feePercent: collectionForm.feePercent,
        imageUri: collectionForm.imageUri || undefined,
        externalUrl: collectionForm.externalUrl || undefined,
        description: collectionForm.description || undefined,
      });
      toast.success(`Collection created: ${out.collectionMint.slice(0, 8)}...`);
      await loadAll(publicKey);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create collection on-chain");
    }
  };

  const handleBootstrapMerkle = async (collectionId: string) => {
    if (!publicKey) return;
    try {
      const out = await bootstrapMerkleTreeOnchain(publicKey, collectionId);
      toast.success(`Merkle tree created: ${out.merkleTree.slice(0, 8)}...`);
      await loadAll(publicKey);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create merkle tree");
    }
  };

  const loadStageRewards = async (campaignId: string) => {
    if (!publicKey) return;
    try {
      const rows = await fetchCampaignStageRewards(publicKey, campaignId);
      if (rows.length > 0) {
        setStageRewards(
          [0, 1, 2, 3].map((idx) => {
            const row = rows.find((r) => r.stage_index === idx);
            return {
              stageIndex: idx,
              rewardName: row?.reward_name ?? `Stage ${idx + 1} Reward`,
              metadataUri: row?.metadata_uri ?? "",
              rarity: row?.rarity ?? (idx === 3 ? "legendary" : idx === 2 ? "epic" : idx === 1 ? "rare" : "common"),
            };
          })
        );
      }
      setStageRewardsCampaignId(campaignId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load stage rewards");
    }
  };

  const handleSaveStageRewards = async () => {
    if (!publicKey || !stageRewardsCampaignId) return;
    try {
      await saveCampaignStageRewards(
        publicKey,
        stageRewardsCampaignId,
        stageRewards.map((r) => ({
          stageIndex: r.stageIndex,
          rewardName: r.rewardName,
          metadataUri: r.metadataUri,
          rarity: r.rarity,
        }))
      );
      toast.success("Stage rewards saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save stage rewards");
    }
  };

  const handleLaunchFlow = async () => {
    if (!publicKey) return;
    setLaunchBusy(true);
    try {
      const out = await launchCampaignWithOnchainCollection({
        wallet: publicKey,
        ...launchForm,
      });
      toast.success(`Created campaign + on-chain collection (${out.campaignId.slice(0, 8)}...)`);
      setStageRewardsCampaignId(out.campaignId);
      await loadAll(publicKey);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not launch creator flow");
    } finally {
      setLaunchBusy(false);
    }
  };

  const handlePublishLive = async () => {
    if (!publicKey || !stageRewardsCampaignId) return;
    try {
      await publishCampaignLive(publicKey, stageRewardsCampaignId);
      toast.success("Campaign is now LIVE for players");
      await loadAll(publicKey);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish campaign live");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <TopBar />
      <main className="flex-1">
        <section className="relative min-h-screen pt-28 pb-16 px-6 md:px-16" style={{ background: "#07060F" }}>
          <div className="container max-w-6xl">
            <motion.h1 className="text-heading mb-2" style={{ fontSize: "2.4rem", color: "#FFFFFF" }}>
              Creator Workspace
            </motion.h1>
            <p className="mb-8" style={{ color: "rgba(255,255,255,0.6)" }}>
              Build no-code campaigns and track earnings with your connected creator wallet.
            </p>

            {!publicKey && <div className="drip-panel p-6">Connect wallet to open creator workspace.</div>}

            {publicKey && !loading && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="drip-panel p-5">Campaigns: {stats.campaigns}</div>
                  <div className="drip-panel p-5">Collections: {stats.collections}</div>
                  <div className="drip-panel-hot p-5">Earnings: {stats.totalEarnings} ROYALE</div>
                </div>

                <div className="drip-panel-hot p-6 mb-8">
                  <p className="mb-2 font-bold" style={{ color: "#FFFFFF" }}>
                    Step 1: Create Campaign + On-chain Collection + Merkle Tree
                  </p>
                  <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.65)" }}>
                    One click launch. Then configure stage rewards and publish live.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input className="p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Campaign name" value={launchForm.campaignName} onChange={(e) => setLaunchForm((p) => ({ ...p, campaignName: e.target.value }))} />
                    <input className="p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Campaign theme" value={launchForm.campaignTheme} onChange={(e) => setLaunchForm((p) => ({ ...p, campaignTheme: e.target.value }))} />
                    <input className="p-2 rounded bg-black/30 border border-violet-500/30" type="number" placeholder="Entry ticket cost" value={launchForm.entryTicketCost} onChange={(e) => setLaunchForm((p) => ({ ...p, entryTicketCost: Number(e.target.value) }))} />
                    <input className="p-2 rounded bg-black/30 border border-violet-500/30" type="number" placeholder="Base reward" value={launchForm.baseRoyaleReward} onChange={(e) => setLaunchForm((p) => ({ ...p, baseRoyaleReward: Number(e.target.value) }))} />
                    <input className="p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Collection name" value={launchForm.collectionName} onChange={(e) => setLaunchForm((p) => ({ ...p, collectionName: e.target.value }))} />
                    <input className="p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Collection symbol" value={launchForm.collectionSymbol} onChange={(e) => setLaunchForm((p) => ({ ...p, collectionSymbol: e.target.value }))} />
                    <input className="p-2 rounded bg-black/30 border border-violet-500/30" type="number" placeholder="Supply" value={launchForm.supply} onChange={(e) => setLaunchForm((p) => ({ ...p, supply: Number(e.target.value) }))} />
                    <input className="md:col-span-2 p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Collection Metadata URI (required)" value={launchForm.collectionMetadataUri} onChange={(e) => setLaunchForm((p) => ({ ...p, collectionMetadataUri: e.target.value }))} />
                    <input className="p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Collection image URI" value={launchForm.collectionImageUri} onChange={(e) => setLaunchForm((p) => ({ ...p, collectionImageUri: e.target.value }))} />
                    <input className="p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Collection external URL" value={launchForm.collectionExternalUrl} onChange={(e) => setLaunchForm((p) => ({ ...p, collectionExternalUrl: e.target.value }))} />
                  </div>
                  <button
                    onClick={() => void handleLaunchFlow()}
                    disabled={launchBusy}
                    className="mt-4 px-4 py-2 rounded bg-violet-600 text-white text-sm font-bold disabled:opacity-50"
                  >
                    {launchBusy ? "LAUNCHING..." : "LAUNCH CAMPAIGN FLOW"}
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  {/* <div className="drip-panel p-6">
                    <p className="mb-4 font-bold" style={{ color: "#FFFFFF" }}>No-Code Campaign Builder</p>
                    <div className="space-y-3">
                      <input className="w-full p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Campaign name" value={campaignForm.name} onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))} />
                      <input className="w-full p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Theme" value={campaignForm.theme} onChange={(e) => setCampaignForm((p) => ({ ...p, theme: e.target.value }))} />
                      <select className="w-full p-2 rounded bg-black/30 border border-violet-500/30" value={campaignForm.linkedCollectionId} onChange={(e) => setCampaignForm((p) => ({ ...p, linkedCollectionId: e.target.value }))}>
                        <option value="">No linked collection</option>
                        {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button onClick={() => void handleCreateCampaign()} className="px-4 py-2 rounded bg-violet-600 text-white text-sm font-bold">CREATE CAMPAIGN</button>
                    </div>
                  </div> */}

                  {/* <div className="drip-panel p-6">
                    <p className="mb-4 font-bold" style={{ color: "#FFFFFF" }}>Collection Builder</p>
                    <div className="space-y-3">
                      <input className="w-full p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Collection name" value={collectionForm.name} onChange={(e) => setCollectionForm((p) => ({ ...p, name: e.target.value }))} />
                      <input className="w-full p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Symbol" value={collectionForm.symbol} onChange={(e) => setCollectionForm((p) => ({ ...p, symbol: e.target.value }))} />
                      <textarea className="w-full p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Description" value={collectionForm.description} onChange={(e) => setCollectionForm((p) => ({ ...p, description: e.target.value }))} />
                      <input className="w-full p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Image URI" value={collectionForm.imageUri} onChange={(e) => setCollectionForm((p) => ({ ...p, imageUri: e.target.value }))} />
                      <input className="w-full p-2 rounded bg-black/30 border border-violet-500/30" placeholder="External URL" value={collectionForm.externalUrl} onChange={(e) => setCollectionForm((p) => ({ ...p, externalUrl: e.target.value }))} />
                      <input className="w-full p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Collection Metadata URI (JSON URL)" value={collectionForm.collectionMetadataUri} onChange={(e) => setCollectionForm((p) => ({ ...p, collectionMetadataUri: e.target.value }))} />
                      <input className="w-full p-2 rounded bg-black/30 border border-violet-500/30" type="number" min={0} max={10} step={0.1} placeholder="Fee Percent (0-10)" value={collectionForm.feePercent} onChange={(e) => setCollectionForm((p) => ({ ...p, feePercent: Number(e.target.value) }))} />
                      <input className="w-full p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Existing Collection Mint (optional)" value={collectionForm.collectionMint} onChange={(e) => setCollectionForm((p) => ({ ...p, collectionMint: e.target.value }))} />
                      <input className="w-full p-2 rounded bg-black/30 border border-violet-500/30" placeholder="Merkle Tree Address (required for cNFT rewards)" value={collectionForm.merkleTree} onChange={(e) => setCollectionForm((p) => ({ ...p, merkleTree: e.target.value }))} />
                      <button onClick={() => void handleCreateCollection()} className="px-4 py-2 rounded bg-amber-500 text-black text-sm font-bold">CREATE COLLECTION</button>
                      <button onClick={() => void handlePrepareMint()} className="px-4 py-2 rounded bg-emerald-500 text-black text-sm font-bold">PREPARE REAL NFT MINT</button>
                    </div>
                  </div> */}
                </div>

                <div className="drip-panel p-6 mb-8">
                  <p className="mb-1 font-bold" style={{ color: "#FFFFFF" }}>Step 2: Stage Reward Metadata (cNFT per stage)</p>
                  <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.65)" }}>
                    Configure all 4 stages, save, then publish live.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {campaigns.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => void loadStageRewards(c.id)}
                        className="px-3 py-1 rounded text-xs font-bold"
                        style={{
                          background: stageRewardsCampaignId === c.id ? "rgba(139,92,246,0.35)" : "rgba(139,92,246,0.15)",
                          color: stageRewardsCampaignId === c.id ? "#F59E0B" : "#A78BFA",
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {stageRewards.map((sr) => (
                      <div key={sr.stageIndex} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input
                          className="p-2 rounded bg-black/30 border border-violet-500/30"
                          placeholder={`Stage ${sr.stageIndex + 1} Reward Name`}
                          value={sr.rewardName}
                          onChange={(e) =>
                            setStageRewards((prev) =>
                              prev.map((x) => (x.stageIndex === sr.stageIndex ? { ...x, rewardName: e.target.value } : x))
                            )
                          }
                        />
                        <input
                          className="p-2 rounded bg-black/30 border border-violet-500/30"
                          placeholder="Metadata URI"
                          value={sr.metadataUri}
                          onChange={(e) =>
                            setStageRewards((prev) =>
                              prev.map((x) => (x.stageIndex === sr.stageIndex ? { ...x, metadataUri: e.target.value } : x))
                            )
                          }
                        />
                        <input
                          className="p-2 rounded bg-black/30 border border-violet-500/30"
                          placeholder="Rarity"
                          value={sr.rarity}
                          onChange={(e) =>
                            setStageRewards((prev) =>
                              prev.map((x) => (x.stageIndex === sr.stageIndex ? { ...x, rarity: e.target.value } : x))
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => void handleSaveStageRewards()}
                    disabled={!stageRewardsCampaignId}
                    className="mt-4 px-4 py-2 rounded bg-violet-600 text-white text-sm font-bold disabled:opacity-50"
                  >
                    SAVE STAGE REWARDS
                  </button>
                  <button
                    onClick={() => void handlePublishLive()}
                    disabled={!stageRewardsCampaignId}
                    className="mt-4 ml-2 px-4 py-2 rounded bg-emerald-500 text-black text-sm font-bold disabled:opacity-50"
                  >
                    Step 3: GO LIVE
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="drip-panel p-6">
                    <p className="mb-3 font-bold" style={{ color: "#FFFFFF" }}>Your Campaigns</p>
                    <div className="space-y-2">
                      {campaigns.map((c) => (
                        <div key={c.id} className="p-3 rounded border border-violet-500/20">
                          <div className="flex items-center justify-between gap-2">
                            <span>{c.name} · {c.theme} · {c.status}</span>
                            <button
                              onClick={() => void handlePublishOnchain(c.id)}
                              className="px-2 py-1 rounded bg-violet-600 text-white text-xs font-bold"
                            >
                              PUBLISH ONCHAIN
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="drip-panel p-6">
                    <p className="mb-3 font-bold" style={{ color: "#FFFFFF" }}>Your Collections</p>
                    <div className="space-y-2">
                      {collections.map((c) => (
                        <div key={c.id} className="p-3 rounded border border-violet-500/20">
                          <div className="flex flex-col gap-2">
                            <span>
                              {c.name} · Supply {c.supply} · {c.status}
                            </span>
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                              Collection Mint: {c.collectionMint ? `${c.collectionMint.slice(0, 8)}...` : "not set"}
                            </span>
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                              Merkle Tree: {c.merkleTree ? `${c.merkleTree.slice(0, 8)}...` : "not set"}
                            </span>
                            <div className="flex gap-2">
                              {/* <button
                                onClick={() => void handleBootstrapCollection(c.id)}
                                className="px-2 py-1 rounded bg-indigo-500 text-white text-xs font-bold"
                              >
                                CREATE COLLECTION ONCHAIN
                              </button>
                              <button
                                onClick={() => void handleBootstrapMerkle(c.id)}
                                className="px-2 py-1 rounded bg-teal-500 text-black text-xs font-bold"
                              >
                                CREATE MERKLE TREE
                              </button> */}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
