/**
 * priceStore.ts
 * In-memory price history store + Jupiter v3 polling
 * Run this as a singleton on the server
 */

import { getFullRSI, getRSIHistory, type RSIResult } from "./rsi";
import { getForecast } from "./chronos";
import { TokenState, PriceSample, Candle } from '~/libs/interfaces'

const JUPITER_PRICE_URL = "https://lite-api.jup.ag/price/v3"; // From config.json
const MAX_HISTORY = 100; // keep 100 samples per token
const CANDLE_MINUTES = 5; // finalize a candle every 5 minutes
const POLL_INTERVAL_MS = 10_000; // poll every 10 seconds

// ── Store ────────────────────────────────────────────────────────────────

const store = new Map<string, TokenState>();
let pollingInterval: ReturnType<typeof setInterval> | null = null;
let watchedTokens: string[] = [];

export function watchToken(mintAddress: string, label?: string) {
    if (!store.has(mintAddress)) {
        store.set(mintAddress, {
            mintAddress,
            samples: [],
            candles: [],
            currentCandle: {},
            candleOpenTime: Date.now(),
            rsi: null,
            forecast: null,
            lastUpdated: 0,
            label,
        });
    }
    if (!watchedTokens.includes(mintAddress)) {
        watchedTokens.push(mintAddress);
    }
}

export function unwatchToken(mintAddress: string) {
    watchedTokens = watchedTokens.filter((t) => t !== mintAddress);
}

export function getTokenState(mintAddress: string): TokenState | undefined {
    return store.get(mintAddress);
}

export function getAllTokenStates(): TokenState[] {
    return Array.from(store.values());
}

// ── Candle Builder ───────────────────────────────────────────────────────

function updateCandle(state: TokenState, price: number, now: number) {
    const minutesSinceOpen = (now - state.candleOpenTime) / 60_000;

    if (minutesSinceOpen >= CANDLE_MINUTES) {
        // Finalize current candle if we have data
        if (state.currentCandle.open !== undefined) {
            const candle: Candle = {
                open: state.currentCandle.open,
                high: state.currentCandle.high!,
                low: state.currentCandle.low!,
                close: price,
                timestamp: state.candleOpenTime,
            };
            state.candles.push(candle);
            if (state.candles.length > MAX_HISTORY) state.candles.shift();
        }
        // Start new candle
        state.currentCandle = { open: price, high: price, low: price };
        state.candleOpenTime = now;
    } else {
        // Update current candle
        if (state.currentCandle.open === undefined) {
            state.currentCandle = { open: price, high: price, low: price };
        } else {
            state.currentCandle.high = Math.max(state.currentCandle.high!, price);
            state.currentCandle.low = Math.min(state.currentCandle.low!, price);
        }
    }
}

// ── Jupiter Fetch ────────────────────────────────────────────────────────

async function fetchPrices(mints: string[]): Promise<void> {
    if (mints.length === 0) return;

    const ids = mints.join(",");
    try {
        const res = await fetch(`${JUPITER_PRICE_URL}?ids=${ids}`);
        if (!res.ok) return;
        const json = await res.json();
        const now = Date.now();

        for (const [mintAddress, raw] of Object.entries(json) as [string, any][]) {
            const state = store.get(mintAddress);
            if (!state) continue;

            const price = parseFloat(raw.usdPrice);
            if (isNaN(price) || price <= 0) continue;

            // Record sample
            const sample: PriceSample = {
                price,
                timestamp: now,
                liquidity: raw.liquidity,
                priceChange24h: raw.priceChange24h,
            };
            state.samples.push(sample);
            if (state.samples.length > MAX_HISTORY) state.samples.shift();

            // Update candle
            updateCandle(state, price, now);

            // Recalculate RSI using close prices from finalized candles
            const closePrices = [
                ...state.candles.map((c) => c.close),
                price, // include current live price as provisional close
            ];
            state.rsi = getFullRSI(closePrices, 14, 9, "EMA");
            state.lastUpdated = now;

            // Run Chronos-2 every time a new candle finalizes
            const justFinalized =
                state.candles.length > 0 &&
                state.candles.at(-1)!.timestamp === state.candleOpenTime - CANDLE_MINUTES * 60_000;

            if (justFinalized && closePrices.length >= 16) {
                // Build covariate histories aligned to close prices
                const rsiHistory = state.candles
                    .map((c) => {
                        // Re-derive RSI at each historical candle close — use running closes
                        const idx = state.candles.indexOf(c);
                        const slice = state.candles.slice(0, idx + 1).map((x) => x.close);
                        const r = getFullRSI(slice, 14, 9, "EMA");
                        return r.insufficientData ? null : r.rsi;
                    })
                    .filter((v): v is number => v !== null);

                const liquidityHistory = state.samples
                    .filter((s) => s.liquidity !== undefined)
                    .slice(-closePrices.length)
                    .map((s) => s.liquidity!);

                // Fire and forget — don't block the polling loop
                getForecast({
                    prices: closePrices.slice(-50),
                    rsi_history: rsiHistory.length >= 10 ? rsiHistory.slice(-50) : undefined,
                    liquidity_history: liquidityHistory.length >= 10 ? liquidityHistory.slice(-50) : undefined,
                    prediction_length: 3,
                    token: mintAddress,
                }).then((forecast) => {
                    if (forecast) state.forecast = forecast;
                });
            }
        }
    } catch (err) {
        console.error("[PriceStore] Fetch error:", err);
    }
}

// ── Polling Control ──────────────────────────────────────────────────────

export function startPolling() {
    if (pollingInterval) return;
    console.log("[PriceStore] Starting price polling...");
    pollingInterval = setInterval(() => fetchPrices(watchedTokens), POLL_INTERVAL_MS);
}

export function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}
