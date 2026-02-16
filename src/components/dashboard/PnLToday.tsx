export default function PnLToday() {
  return (
    <div class="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 relative">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-slate-400 text-sm font-medium">P&L Today</h3>
        <div class="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
          <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
      <div class="space-y-1">
        <div class="text-3xl font-bold text-white">+$1,247.89</div>
        <div class="text-slate-400 text-sm">ROI: +4.3%</div>
        <div class="flex items-center gap-1 text-green-400 text-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          <span>+4.38%</span>
        </div>
      </div>
    </div>
  );
}
