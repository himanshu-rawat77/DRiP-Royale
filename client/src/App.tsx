import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DeckProvider } from "./contexts/DeckContext";
import { PhantomWalletProvider } from "./contexts/PhantomWalletContext";
import { DummyDeckProvider } from "./contexts/DummyDeckContext";
import WalletDeckSync from "./components/WalletDeckSync";
import Home from "./pages/Home";
import VaultPage from "./pages/VaultPage";
import ArenaPage from "./pages/ArenaPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import LedgerPage from "./pages/LedgerPage";
import ProfilePage from "./pages/ProfilePage";
import MatchmakingPage from "./pages/MatchmakingPage";
import DocsPage from "./pages/DocsPage";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/vault"} component={VaultPage} />
      <Route path={"/arena"} component={ArenaPage} />
      <Route path={"/leaderboard"} component={LeaderboardPage} />
      <Route path={"/ledger"} component={LedgerPage} />
      <Route path={"/profile"} component={ProfilePage} />
      <Route path={"/matchmaking"} component={MatchmakingPage} />
      <Route path={"/docs"} component={DocsPage} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <DeckProvider>
          <PhantomWalletProvider>
            <DummyDeckProvider>
              <WalletDeckSync />
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </DummyDeckProvider>
          </PhantomWalletProvider>
        </DeckProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
