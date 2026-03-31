import TopBar from "@/components/TopBar";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Vault from "@/components/Vault";
import Arena from "@/components/Arena";
import Leaderboard from "@/components/Leaderboard";
import Footer from "@/components/Footer";

/**
 * DRiP Royale - Solana Bloodsport
 * 
 * Design Philosophy:
 * - Deep space midnight meets neon prizefight
 * - Electric violet (#8B5CF6) + molten gold (#F59E0B) dual-tone
 * - Frosted glass panels with ambient glows
 * - Dense, gamified information architecture
 * - Professional animations and transitions
 * - High-end luxury aesthetic with premium typography
 */
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <TopBar />
      <main>
        <Hero />
        <HowItWorks />
        <Vault />
        <Arena />
        <Leaderboard />
      </main>
      <Footer />
    </div>
  );
}
