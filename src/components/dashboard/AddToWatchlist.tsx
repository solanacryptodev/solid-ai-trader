import { useBirdeyeTokens } from '../../libs/hooks/useBirdeyeService';

export default function AddToWatchlist() {
  const { tokens, isLoading, error, fetchTokens } = useBirdeyeTokens();

  const handleTestClick = async () => {
    console.log('Testing Birdeye service...');
    await fetchTokens();
    console.log('Tokens:', tokens());
    console.log('Is Loading:', isLoading());
    console.log('Error:', error());
  };

  return (
    <div class="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
      <h3 class="text-white text-lg font-semibold mb-4">Add Token to Watchlist</h3>
      <div class="space-y-4">
        <div>
          <label class="text-slate-400 text-sm mb-2 block">Token Mint Address</label>
          <div class="relative">
            <input
              type="text"
              placeholder="Enter Solana token mint address..."
              class="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>
        <button on:click={handleTestClick} class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add to Watchlist
        </button>
      </div>
    </div>
  );
}
