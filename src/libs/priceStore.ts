/**
 * priceStore.ts
 * In-memory price history store + Jupiter v3 polling
 * Run this as a singleton on the server
 */

import { getFullRSI, getRSIHistory, type RSIResult } from "./rsi";
import { getForecast } from "./chronos";
import { saveForecastReport, formatSmartPrice } from "./forecastReport";
import { TokenState, PriceSample, Candle } from "~/libs/interfaces";

const JUPITER_PRICE_URL = "https://lite-api.jup.ag/price/v3";
const MAX_HISTORY = 100;  // keep 100 samples / candles per token
const CANDLE_MINUTES = 1;    // finalize a candle every 5 minutes
const POLL_INTERVAL_MS = 10_000; // poll every 10 seconds

/**
 * Readiness thresholds.
 * building : < CANDLE_THRESHOLD candles           — just collect, do nothing.
 * warming  : >= CANDLE_THRESHOLD < WARM_THRESHOLD — send to Chronos, no RSI yet.
 * ready    : >= WARM_THRESHOLD                    — full pipeline (RSI covariate valid).
 *
 * RSI(8) needs 9 closes just to produce one value; EMA(9) signal then needs 9
 * more, so reliable RSI requires ~18+ closes.  We gate Chronos calls at 18
 * candles (building) and start adding the RSI covariate at 25 (ready).
 */
const CANDLE_THRESHOLD = 18;
const WARM_THRESHOLD = 25;

// ── Store ─────────────────────────────────────────────────────────────────────

const store = new Map<string, TokenState>();
let pollingInterval: ReturnType<typeof setInterval> | null = null;
let watchedTokens: string[] = [];

export type TokenReadiness = "building" | "warming" | "ready";

export function getTokenReadiness(state: TokenState): TokenReadiness {
    const n = state.candles.length;
    if (n < CANDLE_THRESHOLD) return "building";
    if (n < WARM_THRESHOLD) return "warming";
    return "ready";
}

export function watchToken(mintAddress: string, label?: string) {
    if (!store.has(mintAddress)) {
        store.set(mintAddress, {
            mintAddress,
            label,
            samples: [],
            candles: [],
            currentCandle: {},
            candleOpenTime: Date.now(),
            liquidityHistory: [],
            rsi: null,
            forecast: null,
            lastUpdated: 0,
            signalStatus: `building 0/${CANDLE_THRESHOLD}`,
        });
        console.log(`[PriceStore] Watching ${mintAddress}${label ? ` (label: ${label})` : ""}`);
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

// ── Candle Builder ────────────────────────────────────────────────────────────

function updateCandle(state: TokenState, price: number, now: number): boolean {
    const minutesSinceOpen = (now - state.candleOpenTime) / 60_000;
    let finalized = false;

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
            finalized = true;
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

    return finalized;
}

// ── Jupiter Fetch ─────────────────────────────────────────────────────────────

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

            // ── Record sample ──────────────────────────────────────────────────
            const sample: PriceSample = {
                price,
                timestamp: now,
                liquidity: raw.liquidity,
                priceChange24h: raw.priceChange24h,
            };
            console.log(`[PriceStore] Price Sample: ${formatSmartPrice(sample.price)} @ ${new Date(sample.timestamp).toISOString()}`);
            state.samples.push(sample);
            if (state.samples.length > MAX_HISTORY) state.samples.shift();

            // Track rolling liquidity history
            if (raw.liquidity !== undefined) {
                state.liquidityHistory.push(raw.liquidity as number);
                if (state.liquidityHistory.length > MAX_HISTORY) state.liquidityHistory.shift();
            }

            // ── Update candle ──────────────────────────────────────────────────
            const justFinalized = updateCandle(state, price, now);

            // Finalized candle closes — used for Chronos inputs.
            // When justFinalized, price is the OPENING tick of the NEW candle,
            // not the close of the one that just finished, so we must NOT include
            // it here. state.candles.at(-1).close is already the correct last close.
            const chronosPrices = state.candles.map((c) => c.close);
            console.log(`[PriceStore] Chronos Prices: [${chronosPrices.map(formatSmartPrice).join(", ")}]`);

            // Finalized closes + live price — used for RSI display every tick.
            const livePrices = [...chronosPrices, price];
            // console.log("[PriceStore] Live Prices:", livePrices);

            state.lastUpdated = now;

            // ── Readiness-gated pipeline ───────────────────────────────────────
            const readiness = getTokenReadiness(state);
            console.log("[PriceStore] Readiness:", readiness);

            // ── BUILDING: collect candles only ─────────────────────────────────
            if (readiness === "building") {
                state.signalStatus = `building ${state.candles.length}/${CANDLE_THRESHOLD}`;
                // No Chronos call — not enough context
                continue;
            }

            // ── WARMING: send to Chronos but no RSI covariate yet ──────────────
            if (readiness === "warming") {
                state.signalStatus = `warming ${state.candles.length}/${WARM_THRESHOLD}`;

                // Only fire on candle close to avoid hammering the service
                if (!justFinalized) continue;

                getForecast({
                    prices: chronosPrices,
                    prediction_length: 3,
                    token: mintAddress,
                    // no rsi_history — not reliable yet
                }).then((forecast) => {
                    if (forecast) state.forecast = forecast;
                });
                continue;
            }

            // ── READY: full pipeline ───────────────────────────────────────────
            state.signalStatus = "ready";

            // Only re-run forecast when a new candle finalizes — avoids spam
            if (!justFinalized) {
                // Still update the live RSI on every tick so the dashboard stays fresh
                // RSI display uses livePrices (includes current tick for fresh dashboard reading)
                const rsiResult = getFullRSI(livePrices, 8, 9, "EMA");
                if (!rsiResult.insufficientData) state.rsi = rsiResult;
                continue;
            }

            // On candle close: use livePrices for RSI display, chronosPrices for Chronos.
            // RSI display uses livePrices (includes current tick for fresh dashboard reading)
            const rsiResult = getFullRSI(livePrices, 8, 9, "EMA");
            if (rsiResult.insufficientData) continue;
            state.rsi = rsiResult;

            // RSI covariate uses chronosPrices (finalized closes only — no live price noise)
            const rsiHistory = getRSIHistory(chronosPrices, 8, chronosPrices.length);
            const liquidityHistory = state.liquidityHistory.slice(-chronosPrices.length);

            getForecast({
                prices: chronosPrices.slice(-50),
                rsi_history: rsiHistory.length >= 10 ? rsiHistory.slice(-50) : undefined,
                liquidity_history: liquidityHistory.length >= 10 ? liquidityHistory.slice(-50) : undefined,
                prediction_length: 3,
                token: mintAddress,
            }).then((forecast) => {
                if (!forecast) return;
                state.forecast = forecast;

                // Generate and save the forecast report
                const symbol = state.label ?? mintAddress.slice(0, 8);
                saveForecastReport(
                    symbol,
                    forecast,
                    chronosPrices.slice(-50),
                    rsiResult,
                    state.candles.length
                );
            });
        }
    } catch (err) {
        console.error("[PriceStore] Fetch error:", err);
    }
}

// ── Polling Control ───────────────────────────────────────────────────────────

export function startPolling() {
    if (pollingInterval) return;
    console.log("[PriceStore] Starting price polling...");

    if (watchedTokens.length === 0) {
        console.log("[PriceStore] No tokens to poll yet — polling will begin once tokens are watched.");
    }
    pollingInterval = setInterval(() => fetchPrices(watchedTokens), POLL_INTERVAL_MS);
}

export function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}
