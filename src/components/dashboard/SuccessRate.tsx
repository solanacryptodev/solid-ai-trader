export default function SuccessRate() {
  return (
    <div class="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 relative">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-slate-400 text-sm font-medium">Success Rate</h3>
        <div class="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
          <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
      <div class="space-y-1">
        <div class="text-3xl font-bold text-white">73.2%</div>
        <div class="text-slate-400 text-sm">Last 100 trades</div>
        <div class="flex items-center gap-1 text-green-400 text-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          <span>+1.5%</span>
        </div>
      </div>
    </div>
  );
}
