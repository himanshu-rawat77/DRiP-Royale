import { motion } from "framer-motion";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";

const docsSections = [
  {
    title: "Problem It Is Solving",
    content: [
      "The rapid growth of compressed NFTs (cNFTs) through platforms like DRiP has led to millions of assets being distributed to users at scale. While this has been successful in onboarding users and building large collections, it has also created a significant utility gap. Most of these assets remain idle in wallets, with limited use beyond passive ownership or social signaling.",
      "This lack of utility leads to declining engagement over time. Users collect assets, but without meaningful interaction or purpose, the excitement fades quickly. Additionally, the abundance of common NFTs creates inflationary pressure, reducing perceived value and making it harder for users to differentiate between assets.",
      "There is also a missing layer of interactive experiences in the ecosystem. While NFTs have proven effective for ownership and identity, they have not yet fully unlocked their potential as active, functional digital assets.",
      "As a result, users lack incentives to re-engage with their collections, and creators miss opportunities to extend the lifecycle and value of their work.",
      "DRiP Royale addresses this gap by introducing a system where NFTs are no longer static collectibles, but assets that can actively participate in competitive, high-engagement gameplay.",
    ],
  },
  {
    title: "Project Purpose",
    content: [
      'DRiP Royale aims to solve the "utility gap" for millions of compressed NFTs (cNFTs) distributed via DRiP. While these assets are widely collected, they often sit idle in wallets.',
      "Objective: Transform passive collectibles into active game assets.",
      'Value proposition: Create a deflationary mechanism for common assets while providing a high-adrenaline "winner-takes-all" experience for the Solana community.',
    ],
  },
  {
    title: "Project Design",
    content: [
      'The aesthetic is "Gritty Cyber-Gallery." The UI prioritizes high-fidelity art from DRiP collections while maintaining a clean, competitive gaming interface.',
      "Core UI Modules:",
      "The Vault (Deck Builder): A grid-based interface where users filter their wallet for DRiP assets.",
      'The Arena (Combat UI): A 1v1 split-screen view where cards are "flipped" in the center.',
      "The Ledger (History): A transparent list of won/lost assets with direct links to Solscan.",
    ],
  },
  {
    title: 'Core Gameplay Mechanics: "The War of Art"',
    content: [
      'The game follows the logic of the classic card game War, but with "Permadeath" for the loser’s assets.',
      "Deck Requirement: A standard deck consists of 52 DRiP cNFTs.",
      "Power Scaling: Common cards range from 2-10.",
      "The Duel: Each turn, players flip a card. High card takes both.",
      '"The Royale War": On a tie, 3 cards are staked face-down (at risk) and a 4th card determines the winner of the entire pile.',
      "Settlement: Once a deck is depleted, the smart contract settles the transfers.",
    ],
  },
  {
    title: "Technical Implementation",
    content: [
      'The project uses a "Hybrid Web3" architecture to keep gameplay fast for real-time interactions while remaining secure.',
      "A. Asset Discovery (The Data Layer):",
      "Method: Use the Helius Digital Asset Standard (DAS) API with getAssetsByOwner to instantly index the user's wallet.",
      "Logic: Filter by the DRiP Creator Address so only verified DRiP collectibles enter the game.",
      "B. Transaction & Escrow (The Infrastructure):",
      "Use Solana GameShift to abstract complex blockchain interactions.",
      'Non-Custodial Escrow: When a match is found, GameShift moves the selected "Battle Deck" into a temporary vault.',
      "Atomic Settlement: Upon game completion, the backend triggers a transfer call via GameShift. Because these are cNFTs, transaction fees are nearly zero (below 0.00001 USD).",
      "C. The Game Loop (State Management):",
      "Client-Side: React/Next.js handles animations and UI state.",
      "Server-Side: A Node.js authority validates card values, preventing client-side cheating.",
      "On-Chain: Only the final result (asset transfer) is written to the Solana ledger.",
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <TopBar />
      <main className="flex-1 pt-28 pb-16 px-6 md:px-16">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <p
              className="text-xs font-bold mb-3"
              style={{
                fontFamily: "'Syne', sans-serif",
                color: "#8B5CF6",
                letterSpacing: "0.1em",
              }}
            >
              PROJECT DOCS
            </p>
            <h1
              className="text-3xl md:text-5xl font-bold mb-4"
              style={{
                fontFamily: "'Syne', sans-serif",
                color: "#FFFFFF",
                lineHeight: 1.1,
              }}
            >
              DRiP Royale Documentation
            </h1>
            <p
              className="text-base md:text-lg"
              style={{
                fontFamily: "'Outfit', sans-serif",
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              Product vision, mechanics, and architecture for the DRiP Royale experience.
            </p>
          </motion.div>

          <div className="space-y-6">
            {docsSections.map((section, index) => (
              <motion.section
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                viewport={{ once: true }}
                className="rounded-xl p-6 md:p-8 border"
                style={{
                  background: "rgba(14, 12, 29, 0.75)",
                  borderColor: "rgba(139, 92, 246, 0.22)",
                  boxShadow: "0 0 0 1px rgba(245, 158, 11, 0.05) inset",
                }}
              >
                <h2
                  className="text-xl md:text-2xl font-bold mb-4"
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    color: "#F59E0B",
                  }}
                >
                  {index + 1}. {section.title}
                </h2>
                <div className="space-y-3">
                  {section.content.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-sm md:text-base leading-relaxed"
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        color: "rgba(255, 255, 255, 0.85)",
                      }}
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </motion.section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
