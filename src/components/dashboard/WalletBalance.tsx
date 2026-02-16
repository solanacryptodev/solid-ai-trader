export default function WalletBalance() {
  return (
    <div class="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 relative">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-slate-400 text-sm font-medium">Wallet Balance</h3>
        <div class="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
          <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
      </div>
      <div class="space-y-1">
        <div class="text-3xl font-bold text-white">2,847.32 SOL</div>
        <div class="text-slate-400 text-sm">$271,234.89 USD</div>
        <div class="flex items-center gap-1 text-green-400 text-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          <span>+5.67%</span>
        </div>
      </div>
    </div>
  );
}
