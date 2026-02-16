export default function BotStatus() {
  return (
    <div class="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 relative">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-slate-400 text-sm font-medium">Bot Status</h3>
        <div class="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
          <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </div>
      </div>
      <div class="space-y-1">
        <div class="text-3xl font-bold text-green-400">ACTIVE</div>
        <div class="text-slate-400 text-sm">Runtime: 12h 34m</div>
      </div>
    </div>
  );
}
