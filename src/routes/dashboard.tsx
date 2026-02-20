import { createSignal } from "solid-js";
import WalletBalance from "~/components/dashboard/WalletBalance";
import Trades24H from "~/components/dashboard/Trades24H";
import PnLToday from "~/components/dashboard/PnLToday";
import BotStatus from "~/components/dashboard/BotStatus";
import Potentials from "~/components/dashboard/Potentials";
import Watchlist from "~/components/dashboard/Watchlist";
import AddToWatchlist from "~/components/dashboard/AddToWatchlist";
import Performance12H from "~/components/dashboard/Performance12H";
import Performance48H from "~/components/dashboard/Performance48H";
import SuccessRate from "~/components/dashboard/SuccessRate";
import GasFees from "~/components/dashboard/GasFees";
import type { PotentialToken } from "~/components/dashboard/Potentials";

// Watchlist item interface (needed for the onAnalyze callback)
interface WatchlistItem {
  id: string;
  name: string;
  token: string;
  icon: string;
  price: string;
  change: string;
  changeColor: string;
  score?: number;
  holders?: number;
  address: string;
  signals?: string[];
}

export default function Dashboard() {
  // State for potential tokens (selected from Watchlist via DeepAgent)
  const [potentials, setPotentials] = createSignal<PotentialToken[]>([]);

  // Handle token analysis - add to potentials when user analyzes a token
  function handleAnalyzeToken(token: WatchlistItem) {
    const newPotential: PotentialToken = {
      id: token?.id || "",
      name: token?.name || "",
      symbol: token?.token || "",
      icon: token?.icon || "",
      address: token?.address || "",
    };

    // Only add if not already in the list
    setPotentials((prev) => {
      if (prev.some((p) => p.id === newPotential.id)) {
        return prev;
      }
      return [...prev, newPotential];
    });
  }

  // Remove a token from potentials
  function removePotential(id: string) {
    setPotentials((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <main class="min-h-screen p-6" style="background-color: #0a0e1a;">
      <div class="max-w-7xl mx-auto space-y-6">
        {/* Top Stats Row */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <WalletBalance />
          <Trades24H />
          <PnLToday />
          <BotStatus />
        </div>

        {/* Potentials and Watchlist Row */}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Potentials tokens={potentials()} onRemove={removePotential} />
          <Watchlist onAnalyze={handleAnalyzeToken} />
        </div>

        {/* Add to Watchlist */}
        <div class="max-w-2xl mx-auto">
          <AddToWatchlist />
        </div>

        {/* Bottom Stats Row */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Performance12H />
          <Performance48H />
          <SuccessRate />
          <GasFees />
        </div>
      </div>
    </main>
  );
}
