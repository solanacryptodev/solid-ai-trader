import { For, createSignal, onMount, onCleanup, Show, createEffect } from "solid-js";
import WatchlistModal from "./WatchlistModal";

// Props interface for Watchlist
interface WatchlistProps {
  onAnalyze?: (token: WatchlistItem) => void;
}

// Full Jupiter token from API
interface JupiterTokenFull {
  id: string;
  name: string;
  symbol: string;
  icon?: string;
  holderCount?: number;
  liquidity?: number;
  usdPrice?: number;
  [key: string]: any;
}

// Token shield warning interface
interface TokenShieldWarning {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  source: string;
}

// Watchlist item interface
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
  warnings?: TokenShieldWarning[];
}

// Token candidate response from API - address can be string or Jupiter token object
interface TokenCandidate {
  address: string | JupiterTokenFull;
  symbol?: string;
  name?: string;
  holders: number;
  score: number;
  price?: number;
  liquidity?: number;
  signals?: string[];
  verdict?: 'healthy' | 'risky' | 'red-flag';
  warnings?: TokenShieldWarning[];
}

interface ApiResponse {
  success: boolean;
  count?: number;
  total?: number;
  page?: number;
  totalPages?: number;
  hasMore?: boolean;
  candidates?: TokenCandidate[];
  error?: string;
}

// ---- In-memory price snapshot stores (persist across re-renders, reset on page refresh) ----
// Map<tokenId, { price: number; timestamp: number }>
const priceSnapshots5m = new Map<string, { price: number; timestamp: number }>();
const priceSnapshots1h = new Map<string, { price: number; timestamp: number }>();

const INTERVAL_MS = { "5m": 5 * 60 * 1000, "1h": 60 * 60 * 1000 } as const;

/**
 * Return the stored baseline price for a token in the given interval.
 * - First call: stores the current price and returns it (→ 0% change).
 * - Subsequent calls within the window: returns the stored price.
 * - After the window expires: rotates the snapshot (stores currentPrice as
 *   the new baseline) and returns the OLD price so the change is computed
 *   against the previous window.
 */
function getOrRotateSnapshot(
  tokenId: string,
  currentPrice: number,
  interval: "5m" | "1h"
): number {
  const map = interval === "5m" ? priceSnapshots5m : priceSnapshots1h;
  const maxAge = INTERVAL_MS[interval];
  const existing = map.get(tokenId);
  const now = Date.now();

  if (!existing) {
    map.set(tokenId, { price: currentPrice, timestamp: now });
    return currentPrice; // no prior data → 0% change
  }

  if (now - existing.timestamp >= maxAge) {
    // Window expired – rotate: return the old baseline, store current as new
    const oldPrice = existing.price;
    map.set(tokenId, { price: currentPrice, timestamp: now });
    return oldPrice;
  }

  return existing.price; // still within the window
}

/** Ensure both interval maps have a snapshot for this token (keeps the
 *  non-selected map warm so switching intervals is instant). */
function updateBothSnapshots(tokenId: string, currentPrice: number) {
  getOrRotateSnapshot(tokenId, currentPrice, "5m");
  getOrRotateSnapshot(tokenId, currentPrice, "1h");
}

export default function Watchlist(props: WatchlistProps) {
  const [items, setItems] = createSignal<WatchlistItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  // Pagination state
  const [currentPage, setCurrentPage] = createSignal(1);
  const [totalCount, setTotalCount] = createSignal(0);
  const [totalPages, setTotalPages] = createSignal(1);
  const [hasMore, setHasMore] = createSignal(false);
  // Modal state
  const [selectedToken, setSelectedToken] = createSignal<WatchlistItem | null>(null);
  const [copied, setCopied] = createSignal(false);
  // Track image load status for fallback display
  const [imageStatus, setImageStatus] = createSignal<Map<string, { loaded: boolean; failed: boolean }>>(new Map());
  // Interval selection state (5m or 1h)
  const [selectedInterval, setSelectedInterval] = createSignal<"5m" | "1h">("5m");
  // Polling reference for cleanup
  let pollingTimer: ReturnType<typeof setInterval> | undefined;

  // Helper to extract the string address from TokenCandidate.address
  function getTokenId(address: string | JupiterTokenFull): string {
    if (typeof address === 'string') return address;
    return address?.id || '';
  }

  // Helper to get string address for copy
  function getTokenAddress(address: string | JupiterTokenFull): string {
    if (typeof address === 'string') return address;
    return address?.id || '';
  }

  // Fetch tokens with pagination and dynamic interval
  async function fetchTokens(page: number, interval: string = selectedInterval()) {
    setLoading(true);
    setError(null);
    try {
      // Fetch 10 tokens per page with pagination
      const response = await fetch(`/api/tokenDiscovery?type=organic&interval=${interval}&limit=10&page=${page}`);
      const data: ApiResponse = await response.json();

      if (!data.success || !data.candidates) {
        throw new Error(data.error || "Failed to fetch tokens");
      }

      console.log("Organic tokens fetched:", data.candidates);

      // Update pagination info
      if (data.total !== undefined) setTotalCount(data.total);
      if (data.totalPages !== undefined) setTotalPages(data.totalPages);
      if (data.hasMore !== undefined) setHasMore(data.hasMore);

      // Transform tokens to watchlist items
      const watchlistItems: WatchlistItem[] = data.candidates.map((token: TokenCandidate) => {
        const tokenId = getTokenId(token.address);
        const tokenAddr = getTokenAddress(token.address);

        // Try to get icon from the Jupiter token object
        let icon = token.symbol ? token.symbol.slice(0, 2).toUpperCase() : "??";
        if (typeof token.address === 'object' && token.address.icon) {
          icon = token.address.icon;
        }

        // Update snapshots for BOTH intervals so switching tabs is instant
        const rawPrice = token.price || 0;
        updateBothSnapshots(tokenId, rawPrice);

        // Compute % change against the snapshot for the currently selected interval
        const basePrice = getOrRotateSnapshot(tokenId, rawPrice, selectedInterval());
        const pctChange = basePrice !== 0
          ? ((rawPrice - basePrice) / basePrice) * 100
          : 0;

        let changeColor = "text-slate-400";
        if (pctChange > 0) changeColor = "text-green-400";
        else if (pctChange < 0) changeColor = "text-red-400";

        return {
          id: tokenId,
          name: token.name || (typeof token.address === 'object' ? token.address.name : '') || token.symbol || "",
          token: token.symbol || "",
          icon: icon,
          price: formatPrice(rawPrice),
          change: formatChange(pctChange),
          changeColor,
          score: token.score,
          holders: token.holders,
          address: tokenAddr,
          signals: token.signals,
          warnings: token.warnings,
        };
      });

      console.log("Watchlist items created:", watchlistItems);
      setItems(watchlistItems);
    } catch (err) {
      console.error("Failed to fetch tokens:", err);
      setError("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }

  // Handle interval change: reset to page 1 and re-fetch
  function handleIntervalChange(interval: "5m" | "1h") {
    setSelectedInterval(interval);
    setCurrentPage(1);
    fetchTokens(1, interval);
  }

  onMount(() => {
    // Initial fetch
    fetchTokens(1, selectedInterval());

    // Poll every 30 seconds for updated data
    pollingTimer = setInterval(() => {
      fetchTokens(currentPage(), selectedInterval());
    }, 30_000);
  });

  // Clean up polling interval on unmount
  onCleanup(() => {
    if (pollingTimer) clearInterval(pollingTimer);
  });

  // Handle pagination
  function goToPreviousPage() {
    if (currentPage() > 1) {
      const newPage = currentPage() - 1;
      setCurrentPage(newPage);
      fetchTokens(newPage, selectedInterval());
    }
  }

  function goToNextPage() {
    if (hasMore()) {
      const newPage = currentPage() + 1;
      setCurrentPage(newPage);
      fetchTokens(newPage, selectedInterval());
    }
  }

  function formatPrice(price: number): string {
    if (price >= 1) {
      return `$${price.toFixed(2)}`;
    } else if (price >= 0.01) {
      return `$${price.toFixed(4)}`;
    } else {
      return `$${price.toFixed(6)}`;
    }
  }

  function formatChange(change: number): string {
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(2)}%`;
  }

  function formatHolders(holders?: number): string {
    if (!holders) return "-";
    return holders.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function getScoreColor(score?: number): string {
    if (score === undefined || score === null) return "text-slate-400";
    if (score > 90) return "text-amber-300"; // Gold
    if (score >= 75) return "text-green-400";
    if (score >= 50) return "text-orange-400";
    return "text-red-400";
  }

  // Check if icon is a URL (starts with http)
  function isIconUrl(icon: string): boolean {
    return icon.startsWith("http");
  }

  // Check if image should show fallback (failed or not a valid URL icon)
  function shouldShowFallback(itemId: string, icon: string): boolean {
    if (!isIconUrl(icon)) return true;
    const status = imageStatus().get(itemId);
    return status?.failed === true;
  }

  // Handle image load error - show fallback initials
  function handleImageError(itemId: string) {
    setImageStatus((prev) => {
      const newMap = new Map(prev);
      newMap.set(itemId, { loaded: false, failed: true });
      return newMap;
    });
  }

  // Handle successful image load - verify it's a valid image with dimensions
  function handleImageLoad(itemId: string, event: Event) {
    const img = event.target as HTMLImageElement;
    // If image has no dimensions, it's invalid - show fallback
    if (img.naturalWidth === 0 || img.naturalHeight === 0) {
      handleImageError(itemId);
    } else {
      setImageStatus((prev) => {
        const newMap = new Map(prev);
        newMap.set(itemId, { loaded: true, failed: false });
        return newMap;
      });
    }
  }

  // Open modal for token details
  function openTokenModal(item: WatchlistItem) {
    setSelectedToken(item);
    setCopied(false);
  }

  // Close modal
  function closeModal() {
    setSelectedToken(null);
    setCopied(false);
  }

  // Copy address to clipboard
  async function copyAddress() {
    const token = selectedToken();
    if (token?.address) {
      try {
        await navigator.clipboard.writeText(token.address);
        setCopied(true);
        // Reset copied state after 2 seconds
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy address:", err);
      }
    }
  }

  return (
    <div class="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
      <div class="flex items-center gap-2 mb-4">
        <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <h3 class="text-white text-lg font-semibold">Watchlist</h3>

        {/* Interval toggle buttons */}
        <div class="flex items-center gap-1 ml-3 bg-slate-800/60 rounded-lg p-0.5">
          <button
            class={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${selectedInterval() === "5m"
              ? "bg-blue-500/80 text-white shadow-sm shadow-blue-500/25"
              : "text-slate-400 hover:text-slate-200"
              }`}
            onClick={() => handleIntervalChange("5m")}
          >
            5m
          </button>
          <button
            class={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${selectedInterval() === "1h"
              ? "bg-blue-500/80 text-white shadow-sm shadow-blue-500/25"
              : "text-slate-400 hover:text-slate-200"
              }`}
            onClick={() => handleIntervalChange("1h")}
          >
            1hr
          </button>
        </div>

        <Show when={loading()}>
          <span class="ml-auto text-xs text-slate-400">Loading...</span>
        </Show>
        <Show when={!loading()}>
          <span class="ml-auto text-xs text-slate-500">Auto-refresh: 30s</span>
        </Show>
      </div>

      <Show when={error()}>
        <div class="text-red-400 text-sm mb-4">{error()}</div>
      </Show>

      <div class="space-y-3">
        <For each={items()}>
          {(item) => (
            <div class="bg-slate-800/40 rounded-lg p-4 flex flex-col gap-2 hover:bg-slate-800/60 transition-colors">
              {/* Row 1: Main content */}
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <Show when={!shouldShowFallback(item.id, item.icon)} fallback={
                    <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {item.icon}
                    </div>
                  }>
                    <img
                      src={item.icon}
                      alt={`${item.token} icon`}
                      class="w-10 h-10 rounded-full object-cover"
                      onError={() => handleImageError(item.id)}
                      onLoad={(e) => handleImageLoad(item.id, e)}
                    />
                  </Show>
                  <div>
                    <div class="text-white font-medium">{item.token}</div>
                    <Show when={item.name && item.name !== item.token}>
                      <div class="text-slate-400 text-xs">{item.name}</div>
                    </Show>
                  </div>
                </div>

                <div class="flex items-center gap-6">
                  {/* Holders */}
                  <div class="text-center min-w-[60px]">
                    <div class="text-slate-400 text-xs">Holders</div>
                    <div class="text-white font-semibold text-sm">{formatHolders(item.holders)}</div>
                  </div>

                  {/* Score */}
                  <div class="text-center min-w-[50px]">
                    <div class="text-slate-400 text-xs">Score</div>
                    <div class={`font-semibold text-sm ${getScoreColor(item.score)}`}>
                      {item.score ?? '-'}
                    </div>
                  </div>

                  {/* Price */}
                  <div class="text-right min-w-[70px]">
                    <div class="text-white font-semibold">{item.price}</div>
                    <div class={`text-sm ${item.changeColor}`}>{item.change}</div>
                  </div>
                </div>

                <button
                  class="ml-2 text-slate-400 hover:text-white transition-colors"
                  onClick={() => openTokenModal(item)}
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>

              {/* Row 2: Signals at bottom */}
              <Show when={item.signals && item.signals.length > 0}>
                <div class="flex flex-wrap gap-1">
                  <For each={item.signals}>
                    {(signal) => (
                      <span class="text-[10px] text-slate-300/70 bg-slate-700/40 rounded px-1.5 py-0.5">
                        {signal}
                      </span>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>

      {/* Pagination Controls */}
      <Show when={totalCount() > 0}>
        <div class="flex items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
          <div class="text-slate-400 text-sm">
            Showing {items().length} of {totalCount()} tokens
          </div>
          <div class="flex items-center gap-2">
            <button
              class={`px-3 py-1.5 text-sm rounded-lg transition-colors ${currentPage() > 1
                ? "bg-slate-700 text-white hover:bg-slate-600"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              onClick={goToPreviousPage}
              disabled={currentPage() <= 1 || loading()}
            >
              Previous
            </button>
            <span class="text-slate-400 text-sm px-2">
              Page {currentPage()} {totalPages() > 1 ? `of ${totalPages()}` : ''}
            </span>
            <button
              class={`px-3 py-1.5 text-sm rounded-lg transition-colors ${hasMore()
                ? "bg-slate-700 text-white hover:bg-slate-600"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              onClick={goToNextPage}
              disabled={!hasMore() || loading()}
            >
              Next
            </button>
          </div>
        </div>
      </Show>

      {/* Token Details Modal */}
      <Show when={selectedToken()}>
        {(token) => (
          <WatchlistModal
            token={token()}
            onClose={closeModal}
            onCopy={copyAddress}
            copied={copied()}
            shouldShowFallback={shouldShowFallback}
            handleImageError={handleImageError}
            onAnalyze={props.onAnalyze}
          />
        )}
      </Show>
    </div>
  );
}
