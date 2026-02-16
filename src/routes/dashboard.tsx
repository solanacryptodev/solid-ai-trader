import WalletBalance from "~/components/dashboard/WalletBalance";
import Trades24H from "~/components/dashboard/Trades24H";
import PnLToday from "~/components/dashboard/PnLToday";
import BotStatus from "~/components/dashboard/BotStatus";
import OpenOrders from "~/components/dashboard/OpenOrders";
import Watchlist from "~/components/dashboard/Watchlist";
import AddToWatchlist from "~/components/dashboard/AddToWatchlist";
import Performance12H from "~/components/dashboard/Performance12H";
import Performance48H from "~/components/dashboard/Performance48H";
import SuccessRate from "~/components/dashboard/SuccessRate";
import GasFees from "~/components/dashboard/GasFees";

export default function Dashboard() {
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

        {/* Open Orders and Watchlist Row */}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OpenOrders />
          <Watchlist />
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
