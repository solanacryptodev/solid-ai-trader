import { useLocation } from "@solidjs/router";

export default function Nav() {
  const location = useLocation();
  const active = (path: string) =>
    path == location.pathname ? "border-sky-400 text-white" : "border-transparent text-gray-300 hover:text-white hover:border-sky-400";

  const isActive = (path: string) => path === location.pathname;

  return (
    <nav class="w-full" style="background-color: #000000; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-14">
          {/* Logo Section */}
          <div class="flex items-center">
            <div class="flex items-center">
              <svg class="w-6 h-6 text-white mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
              </svg>
              <span class="text-xl font-bold text-white">The Solid Trader</span>
            </div>
          </div>

          {/* Navigation Routes */}
          <div class="flex items-center space-x-1">
            <a
              href="/dashboard"
              class={`px-3 py-2 rounded-md text-sm font-medium border-b-2 transition-colors duration-200 ${active("/dashboard")}`}
            >
              Dashboard
            </a>
            <a
              href="/trades"
              class={`px-3 py-2 rounded-md text-sm font-medium border-b-2 transition-colors duration-200 ${active("/trades")}`}
            >
              Trades
            </a>
          </div>

          {/* Right side - Bell icon */}
          <div class="flex items-center">
            <button class="p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors duration-200">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
