# Implementation Plan - Chronos-2, Chronos-2 HTTP Microservice, PriceStore, RSI, and more

The following code is what must be implemented:

## 1. PriceStore - done

```
/**
 * priceStore.ts
 * In-memory price history store + Jupiter v3 polling
 * Run this as a singleton on the server
 */

import { getFullRSI, getRSIHistory, type RSIResult } from "./rsi";
import { getForecast, type ChronosForecastResponse } from "./chronos";

const JUPITER_PRICE_URL = ""; // TODO: Add Jupiter Lite API key from config.json
const MAX_HISTORY       = 100;  // keep 100 samples per token
const CANDLE_MINUTES    = 5;    // finalize a candle every 5 minutes
const POLL_INTERVAL_MS  = 10_000; // poll every 10 seconds

// ── Types ────────────────────────────────────────────────────────────────

export interface PriceSample {
  price: number;
  timestamp: number;
  liquidity?: number;
  priceChange24h?: number;
}

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number; // candle open time
}

export interface TokenState {
  mintAddress: string;
  samples: PriceSample[];
  candles: Candle[];
  currentCandle: Partial<Candle> & { open?: number; high?: number; low?: number };
  candleOpenTime: number;
  rsi: RSIResult | null;
  forecast: ChronosForecastResponse | null;
  lastUpdated: number;
  label?: string;
}

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
  watchedTokens = watchedTokens.filter(t => t !== mintAddress);
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
        open:      state.currentCandle.open,
        high:      state.currentCandle.high!,
        low:       state.currentCandle.low!,
        close:     price,
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
      state.currentCandle.low  = Math.min(state.currentCandle.low!, price);
    }
  }
}

// ── Jupiter Fetch ────────────────────────────────────────────────────────

async function fetchPrices(mints: string[]): Promise<void> {
  if (mints.length === 0) return;

  const ids = mints.join(",");
  try {
    const res  = await fetch(`${JUPITER_PRICE_URL}?ids=${ids}`);
    if (!res.ok) return;
    const json = await res.json();
    const now  = Date.now();

    for (const [mintAddress, raw] of Object.entries(json) as [string, any][]) {
      const state = store.get(mintAddress);
      if (!state) continue;

      const price = parseFloat(raw.usdPrice);
      if (isNaN(price) || price <= 0) continue;

      // Record sample
      const sample: PriceSample = {
        price,
        timestamp: now,
        liquidity:       raw.liquidity,
        priceChange24h:  raw.priceChange24h,
      };
      state.samples.push(sample);
      if (state.samples.length > MAX_HISTORY) state.samples.shift();

      // Update candle
      updateCandle(state, price, now);

      // Recalculate RSI using close prices from finalized candles
      const closePrices = [
        ...state.candles.map(c => c.close),
        price, // include current live price as provisional close
      ];
      state.rsi = getFullRSI(closePrices, 14, 9, "EMA");
      state.lastUpdated = now;

      // Run Chronos-2 every time a new candle finalizes
      const justFinalized = state.candles.length > 0 &&
        state.candles.at(-1)!.timestamp === state.candleOpenTime - CANDLE_MINUTES * 60_000;

      if (justFinalized && closePrices.length >= 16) {
        // Build covariate histories aligned to close prices
        const rsiHistory = state.candles
          .map(c => {
            // Re-derive RSI at each historical candle close — use running closes
            const idx = state.candles.indexOf(c);
            const slice = state.candles.slice(0, idx + 1).map(x => x.close);
            const r = getFullRSI(slice, 14, 9, "EMA");
            return r.insufficientData ? null : r.rsi;
          })
          .filter((v): v is number => v !== null);

        const liquidityHistory = state.samples
          .filter(s => s.liquidity !== undefined)
          .slice(-closePrices.length)
          .map(s => s.liquidity!);

        // Fire and forget — don't block the polling loop
        getForecast({
          prices:            closePrices.slice(-50),
          rsi_history:       rsiHistory.length >= 10 ? rsiHistory.slice(-50) : undefined,
          liquidity_history: liquidityHistory.length >= 10 ? liquidityHistory.slice(-50) : undefined,
          prediction_length: 3,
          token:             mintAddress,
        }).then(forecast => {
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
```

## 2. RSI - done

```
/**
 * rsi.ts
 * Full RSI implementation with smoothing line (EMA or SMA)
 */

export type SmoothingType = "EMA" | "SMA";

export interface RSIResult {
  rsi: number;
  signal: "oversold" | "overbought" | "neutral";
  smoothingLine: number | null;
  crossover: "above_signal" | "below_signal" | null;
  length: number;
  smoothingLength: number;
  smoothingType: SmoothingType;
  insufficientData: boolean;
  samplesHave: number;
  samplesNeed: number;
}

function calculateRSIValues(prices: number[], length: number): number[] {
  if (prices.length < length + 1) return [];

  const deltas = prices.map((p, i) => (i === 0 ? null : p - prices[i - 1])).slice(1) as number[];
  const gains  = deltas.map(d => (d > 0 ? d : 0));
  const losses = deltas.map(d => (d < 0 ? -d : 0));

  let avgGain = gains.slice(0, length).reduce((a, b) => a + b, 0) / length;
  let avgLoss = losses.slice(0, length).reduce((a, b) => a + b, 0) / length;

  const rsiValues: number[] = [];

  for (let i = length; i < deltas.length; i++) {
    avgGain = (avgGain * (length - 1) + gains[i]) / length;
    avgLoss = (avgLoss * (length - 1) + losses[i]) / length;
    const rs  = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
    rsiValues.push(rsi);
  }

  return rsiValues;
}

function calculateEMA(values: number[], length: number): number | null {
  if (values.length < length) return null;
  const k = 2 / (length + 1);
  let ema = values.slice(0, length).reduce((a, b) => a + b, 0) / length;
  for (let i = length; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateSMA(values: number[], length: number): number | null {
  if (values.length < length) return null;
  const slice = values.slice(-length);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function getFullRSI(
  prices: number[],
  length = 14,
  smoothingLength = 9,
  smoothingType: SmoothingType = "EMA"
): RSIResult {
  const samplesNeed = length + smoothingLength + 1;

  if (prices.length < samplesNeed) {
    return {
      rsi: 0,
      signal: "neutral",
      smoothingLine: null,
      crossover: null,
      length,
      smoothingLength,
      smoothingType,
      insufficientData: true,
      samplesHave: prices.length,
      samplesNeed,
    };
  }

  const rsiValues = calculateRSIValues(prices, length);
  const currentRSI = rsiValues.at(-1)!;

  const smoothingLine =
    smoothingType === "EMA"
      ? calculateEMA(rsiValues, smoothingLength)
      : calculateSMA(rsiValues, smoothingLength);

  const signal: RSIResult["signal"] =
    currentRSI < 30 ? "oversold" : currentRSI > 70 ? "overbought" : "neutral";

  const crossover: RSIResult["crossover"] = smoothingLine
    ? currentRSI > smoothingLine
      ? "above_signal"
      : "below_signal"
    : null;

  return {
    rsi: parseFloat(currentRSI.toFixed(2)),
    signal,
    smoothingLine: smoothingLine !== null ? parseFloat(smoothingLine.toFixed(2)) : null,
    crossover,
    length,
    smoothingLength,
    smoothingType,
    insufficientData: false,
    samplesHave: prices.length,
    samplesNeed,
  };
}

/** Returns the last N RSI values for charting */
export function getRSIHistory(prices: number[], length = 14, count = 50): number[] {
  const all = calculateRSIValues(prices, length);
  return all.slice(-count);
}
```

## 3. Chronos-2 HTTP Microservice in Python - done

```
"""
Chronos-2 HTTP Microservice
Upgraded from Chronos-Bolt-Base to Chronos-2 with full covariate support.

Install:
    pip install fastapi uvicorn pandas pyarrow numpy torch
    pip install git+https://github.com/amazon-science/chronos-forecasting.git

Run:
    python server.py  ->  http://localhost:8000
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np
import torch
import uvicorn
import logging
from typing import Optional
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Chronos-2 Trading Service")

# ── Model ─────────────────────────────────────────────────────────────────────

pipeline = None

@app.on_event("startup")
async def load_model():
    global pipeline
    logger.info("Loading Chronos-2 (~120M params, downloading on first run)...")
    from chronos import Chronos2Pipeline
    pipeline = Chronos2Pipeline.from_pretrained(
        "amazon/chronos-2",
        device_map="cpu",          # swap to "cuda" if you add a GPU
        torch_dtype=torch.float32,
    )
    logger.info("Chronos-2 ready.")


# ── Schemas ───────────────────────────────────────────────────────────────────

class ForecastRequest(BaseModel):
    prices: list[float]                         # close price per candle (required)
    token: Optional[str] = None

    # Past covariates — optional but improve accuracy significantly
    rsi_history:       Optional[list[float]] = None  # RSI(14) aligned to prices
    liquidity_history: Optional[list[float]] = None  # USD liquidity per candle
    volume_history:    Optional[list[float]] = None  # volume per candle
    buy_pressure:      Optional[list[float]] = None  # buy/sell ratio per candle

    prediction_length: int = 3   # candles ahead  (3 * 5min = 15 min lookahead)
    candle_minutes:    int = 5   # used to generate synthetic timestamps


class QuantileForecast(BaseModel):
    low:    float   # 10th pct — bear case
    median: float   # 50th pct — base case
    high:   float   # 90th pct — bull case


class ForecastResponse(BaseModel):
    token:           Optional[str]
    current_price:   float
    forecasts:       list[QuantileForecast]
    direction:       str     # "bullish" | "bearish" | "neutral"
    confidence:      float   # 0-1
    pct_change:      float   # median % change vs current price
    covariates_used: list[str]
    summary:         str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _align(arr: Optional[list[float]], length: int) -> Optional[list[float]]:
    """Trim or front-pad a covariate array to match target length."""
    if arr is None:
        return None
    if len(arr) >= length:
        return arr[-length:]
    return [arr[0]] * (length - len(arr)) + arr


def _build_context_df(req: ForecastRequest) -> tuple[pd.DataFrame, list[str]]:
    n   = len(req.prices)
    end = datetime.utcnow().replace(second=0, microsecond=0)
    ts  = pd.date_range(
        end=end, periods=n, freq=f"{req.candle_minutes}min"
    )

    df = pd.DataFrame({
        "item_id":   req.token or "token",
        "timestamp": ts,
        "target":    req.prices,
    })

    covariates_used = []
    for col, arr in [
        ("rsi",          req.rsi_history),
        ("liquidity",    req.liquidity_history),
        ("volume",       req.volume_history),
        ("buy_pressure", req.buy_pressure),
    ]:
        aligned = _align(arr, n)
        if aligned is not None:
            df[col] = aligned
            covariates_used.append(col)

    return df, covariates_used


# ── Forecast ──────────────────────────────────────────────────────────────────

@app.post("/forecast", response_model=ForecastResponse)
async def forecast(req: ForecastRequest):
    if pipeline is None:
        raise HTTPException(503, "Model not loaded yet")
    if len(req.prices) < 15:
        raise HTTPException(400, f"Need >= 15 price points, got {len(req.prices)}")

    try:
        context_df, covariates_used = _build_context_df(req)

        # predict_df returns columns: item_id, timestamp, mean, 0.1, 0.5, 0.9 ...
        pred_df = pipeline.predict_df(
            context_df,
            prediction_length=req.prediction_length,
            quantile_levels=[0.1, 0.5, 0.9],
            id_column="item_id",
            timestamp_column="timestamp",
            target="target",
        )

        rows = pred_df.sort_values("timestamp")
        forecasts = [
            QuantileForecast(
                low=float(row["0.1"]),
                median=float(row["0.5"]),
                high=float(row["0.9"]),
            )
            for _, row in rows.iterrows()
        ]

        current_price = req.prices[-1]
        pct_change    = (forecasts[-1].median - current_price) / current_price

        # Tighter threshold than Bolt — Chronos-2 is more accurate
        direction = (
            "bullish" if pct_change > 0.01 else
            "bearish" if pct_change < -0.01 else
            "neutral"
        )

        avg_spread = float(np.mean([
            (f.high - f.low) / max(abs(current_price), 1e-12)
            for f in forecasts
        ]))
        confidence = round(float(max(0.0, min(1.0, 1.0 - avg_spread))), 3)

        cov_note = (
            f" (covariates: {', '.join(covariates_used)})"
            if covariates_used else " (univariate)"
        )
        summary = (
            f"Median {'+' if pct_change >= 0 else ''}{pct_change*100:.2f}% "
            f"over {req.prediction_length}×{req.candle_minutes}min{cov_note}. "
            f"Range ${forecasts[0].low:.8g}–${forecasts[-1].high:.8g}"
        )

        return ForecastResponse(
            token=req.token,
            current_price=current_price,
            forecasts=forecasts,
            direction=direction,
            confidence=confidence,
            pct_change=round(pct_change * 100, 4),
            covariates_used=covariates_used,
            summary=summary,
        )

    except Exception as e:
        logger.exception(f"Forecast error [{req.token}]: {e}")
        raise HTTPException(500, str(e))


@app.get("/health")
async def health():
    return {"status": "ok", "model": "chronos-2", "model_loaded": pipeline is not None}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
```

## 4. Chronos 2 TS - done

```
/**
 * chronos.ts
 * Client for the Chronos-2 Python microservice
 */

export interface QuantileForecast {
  low: number;
  median: number;
  high: number;
}

export interface ChronosForecastResponse {
  token: string | null;
  current_price: number;
  forecasts: QuantileForecast[];
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
  pct_change: number;          // median % change vs current price
  covariates_used: string[];   // which covariates Chronos-2 received
  summary: string;
}

export interface ChronosInput {
  prices: number[];
  rsi_history?:       number[];   // past covariate
  liquidity_history?: number[];   // past covariate
  volume_history?:    number[];   // past covariate
  buy_pressure?:      number[];   // past covariate
  prediction_length?: number;
  token?: string;
}

const CHRONOS_URL = process.env.CHRONOS_SERVICE_URL ?? "http://localhost:8000";

export async function getForecast(input: ChronosInput): Promise<ChronosForecastResponse | null> {
  try {
    const res = await fetch(`${CHRONOS_URL}/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prices:            input.prices,
        rsi_history:       input.rsi_history       ?? null,
        liquidity_history: input.liquidity_history ?? null,
        volume_history:    input.volume_history    ?? null,
        buy_pressure:      input.buy_pressure      ?? null,
        prediction_length: input.prediction_length ?? 3,
        token:             input.token             ?? null,
      }),
      signal: AbortSignal.timeout(15_000), // 15s — Chronos-2 on CPU is slower
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[Chronos-2] Forecast failed:", err);
      return null;
    }

    return await res.json() as ChronosForecastResponse;
  } catch (err) {
    console.error("[Chronos-2] Request error:", err);
    return null;
  }
}

export async function isChronosHealthy(): Promise<boolean> {
  try {
    const res  = await fetch(`${CHRONOS_URL}/health`, { signal: AbortSignal.timeout(3_000) });
    const data = await res.json();
    return data.status === "ok" && data.model_loaded === true && data.model === "chronos-2";
  } catch {
    return false;
  }
}
```

## 5. tokens.ts - done

### Purpose: 

```
`tokens.ts` is essentially the **control layer between your dashboard and your trading engine.**

Remember the architecture — `priceStore.ts` is the brain. It holds all the state, runs the polling loop, builds candles, calculates RSI, and triggers Chronos-2. But it's just a TypeScript module running on the server. Nothing can talk to it from the outside without an API route exposing it.

That's exactly what `tokens.ts` does. It's a SolidStart API route sitting at `/api/tokens` that gives your dashboard (and anything else) three things:

**GET `/api/tokens`**
Your dashboard calls this every 10 seconds to refresh what it displays. It reaches into `priceStore.ts`, grabs every watched token's current state — price, RSI, Chronos forecast, candle count, sparkline — and serializes it into JSON the UI can render.

**POST `/api/tokens`**
When you type a mint address into the dashboard and click "Watch Token", the UI hits this endpoint with `{ mintAddress, label }`. It calls `watchToken()` in `priceStore.ts` which registers that token and starts including it in every poll cycle. Without this you'd have to hardcode every token you want to watch at startup.

**DELETE `/api/tokens`**
When you remove a token from the dashboard it hits this endpoint, which calls `unwatchToken()` to stop polling it and drop it from state.

So in plain terms the relationship is:

Dashboard UI  ←→  tokens.ts  ←→  priceStore.ts
  (browser)       (API route)     (trading engine)


The dashboard never touches `priceStore.ts` directly — it can't, it's running in the browser and `priceStore.ts` is server-side. `tokens.ts` is the bridge that safely exposes just the operations the UI needs without leaking any internals.

It also means in the future if you want to add a panic sell button, a position logger, or an external webhook that adds tokens programmatically, you'd add those as new routes in the same pattern — another API file that talks to the engine layer underneath.
```

```
/**
 * src/routes/api/tokens.ts
 * SolidStart API endpoint — returns all watched token states
 * GET  /api/tokens          → all token states
 * POST /api/tokens/watch    → { mintAddress, label } → start watching
 * DELETE /api/tokens/watch  → { mintAddress } → stop watching
 */

import type { APIEvent } from "@solidjs/start/server";
import {
  getAllTokenStates,
  watchToken,
  unwatchToken,
  startPolling,
} from "~/lib/priceStore";

// Start polling when this module loads (server startup)
startPolling();

export async function GET(_event: APIEvent) {
  const states = getAllTokenStates().map(s => ({
    mintAddress:   s.mintAddress,
    label:         s.label ?? s.mintAddress.slice(0, 8) + "...",
    price:         s.samples.at(-1)?.price ?? null,
    liquidity:     s.samples.at(-1)?.liquidity ?? null,
    priceChange24h: s.samples.at(-1)?.priceChange24h ?? null,
    rsi:           s.rsi,
    forecast:      s.forecast,
    candleCount:   s.candles.length,
    sampleCount:   s.samples.length,
    lastUpdated:   s.lastUpdated,
    // Sparkline: last 20 close prices
    sparkline:     s.candles.slice(-20).map(c => c.close),
  }));

  return new Response(JSON.stringify(states), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(event: APIEvent) {
  const body = await event.request.json();
  const { mintAddress, label } = body;

  if (!mintAddress) {
    return new Response(JSON.stringify({ error: "mintAddress required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  watchToken(mintAddress, label);
  return new Response(JSON.stringify({ ok: true, mintAddress }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(event: APIEvent) {
  const body = await event.request.json();
  unwatchToken(body.mintAddress);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
```

## 6. Python Test

```
"""
test_chronos.py
───────────────
Tests server.py directly (no HTTP) — loads Chronos-2 inline,
runs a forecast on mock memecoin data, prints results to console,
and renders a matplotlib chart showing:
  - historical prices (context)
  - actual "future" prices (what really happened)
  - Chronos-2 forecast: low / median / high quantiles

Run:
    python test_chronos.py

No server needed — this bypasses FastAPI entirely and calls
the model the same way server.py does internally.
"""

import torch
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")   # headless — saves to PNG instead of opening a window
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from datetime import datetime, timedelta
import math, random, sys

# ── 1. Mock memecoin price generator ─────────────────────────────────────────

def generate_memecoin_prices(n_history: int, n_future: int, seed: int = 42) -> tuple[list[float], list[float]]:
    """
    Generates a realistic memecoin price series:
      Phase 1 (history): slow accumulation → sharp pump → partial dump
      Phase 2 (future):  continuation — either recovery or further dump
    Returns (history_prices, future_prices)
    """
    random.seed(seed)
    np.random.seed(seed)

    prices = [0.000270]

    # Accumulation phase (first 40% of history)
    accum_end = int(n_history * 0.4)
    for _ in range(accum_end):
        drift   = 0.003
        noise   = random.gauss(0, 0.012)
        prices.append(max(0.000001, prices[-1] * (1 + drift + noise)))

    # Pump phase (next 30%)
    pump_end = int(n_history * 0.7)
    for _ in range(pump_end - accum_end):
        drift   = 0.055
        noise   = random.gauss(0, 0.025)
        prices.append(max(0.000001, prices[-1] * (1 + drift + noise)))

    # Cooldown / partial dump (remaining history)
    for _ in range(n_history - pump_end):
        drift   = -0.018
        noise   = random.gauss(0, 0.030)
        prices.append(max(0.000001, prices[-1] * (1 + drift + noise)))

    history = prices[:n_history]

    # Future: gentle recovery with noise
    future = []
    last = history[-1]
    for _ in range(n_future):
        drift  = random.uniform(-0.01, 0.025)
        noise  = random.gauss(0, 0.020)
        last   = max(0.000001, last * (1 + drift + noise))
        future.append(last)

    return history, future


def generate_rsi(prices: list[float], period: int = 14) -> list[float]:
    """Simple RSI calculation for covariate generation."""
    rsi_vals = [50.0] * period
    deltas = [prices[i+1] - prices[i] for i in range(len(prices)-1)]
    gains  = [max(d, 0) for d in deltas]
    losses = [max(-d, 0) for d in deltas]

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period-1) + gains[i]) / period
        avg_loss = (avg_loss * (period-1) + losses[i]) / period
        rs  = avg_gain / avg_loss if avg_loss > 0 else 100
        rsi = 100 - (100 / (1 + rs))
        rsi_vals.append(rsi)

    return rsi_vals[:len(prices)]


# ── 2. Run Chronos-2 directly ─────────────────────────────────────────────────

def run_forecast(history: list[float], rsi_history: list[float], prediction_length: int = 3):
    print("\n[1/3] Loading Chronos-2-small...")
    from chronos import Chronos2Pipeline

    pipeline = Chronos2Pipeline.from_pretrained(
        "amazon/chronos-2-small",
        device_map="cpu",
        torch_dtype=torch.float32,
    )
    print("      ✅ Model loaded")

    n  = len(history)
    ts = pd.date_range(end=datetime.utcnow(), periods=n, freq="5min")

    context_df = pd.DataFrame({
        "item_id":   "MOCK_TOKEN",
        "timestamp": ts,
        "target":    history,
        "rsi":       rsi_history,
    })

    print(f"\n[2/3] Running forecast on {n} candles (RSI covariate included)...")
    pred_df = pipeline.predict_df(
        context_df,
        prediction_length=prediction_length,
        quantile_levels=[0.1, 0.5, 0.9],
        id_column="item_id",
        timestamp_column="timestamp",
        target="target",
    )

    rows     = pred_df.sort_values("timestamp")
    lows     = [float(r["0.1"]) for _, r in rows.iterrows()]
    medians  = [float(r["0.5"]) for _, r in rows.iterrows()]
    highs    = [float(r["0.9"]) for _, r in rows.iterrows()]

    return lows, medians, highs


# ── 3. Console output ─────────────────────────────────────────────────────────

def print_results(history, future, lows, medians, highs):
    current = history[-1]
    print("\n[3/3] Results")
    print("─" * 60)
    print(f"  Context candles : {len(history)}")
    print(f"  Current price   : ${current:.8f}")
    print(f"  Forecast steps  : {len(medians)} × 5min\n")

    print(f"  {'Step':<8} {'Low (10%)':<16} {'Median (50%)':<16} {'High (90%)':<16} {'Actual':<16} {'Δ Median'}")
    print(f"  {'─'*7} {'─'*15} {'─'*15} {'─'*15} {'─'*15} {'─'*10}")

    for i, (lo, med, hi) in enumerate(zip(lows, medians, highs)):
        actual   = future[i] if i < len(future) else None
        pct      = (med - current) / current * 100
        act_str  = f"${actual:.8f}" if actual else "n/a"
        act_err  = f"  ({(actual - med)/med*100:+.1f}% off)" if actual else ""
        print(f"  +{(i+1)*5}min  ${lo:<15.8f} ${med:<15.8f} ${hi:<15.8f} {act_str:<16}{act_err}")

    final_pct = (medians[-1] - current) / current * 100
    direction = "BULLISH ▲" if final_pct > 1 else "BEARISH ▼" if final_pct < -1 else "NEUTRAL ◆"
    avg_spread = sum((h-l)/current for h,l in zip(highs,lows)) / len(highs)
    confidence = max(0, min(1, 1 - avg_spread))

    print(f"\n  Direction   : {direction}")
    print(f"  Δ (median)  : {final_pct:+.2f}%")
    print(f"  Confidence  : {confidence*100:.1f}%")
    print("─" * 60)


# ── 4. Matplotlib chart ───────────────────────────────────────────────────────

def render_chart(history, future, lows, medians, highs, out_path="chronos_test_result.png"):
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 9), gridspec_kw={"height_ratios": [3, 1]})
    fig.patch.set_facecolor("#080c14")
    for ax in (ax1, ax2):
        ax.set_facecolor("#0a1220")
        ax.tick_params(colors="#64748b")
        ax.spines[:].set_color("#1e2a3a")

    n_hist = len(history)
    n_fore = len(medians)

    # X axis: candle indices
    hist_x   = list(range(n_hist))
    fore_x   = list(range(n_hist, n_hist + n_fore))
    future_x = list(range(n_hist, n_hist + len(future)))

    # ── Price chart ──
    ax1.plot(hist_x, history, color="#3b82f6", linewidth=1.5, label="History", zorder=3)

    # Confidence band (low → high)
    ax1.fill_between(fore_x, lows, highs, color="#f59e0b", alpha=0.15, label="10–90% band", zorder=2)

    # Median forecast line
    ax1.plot(fore_x, medians, color="#f59e0b", linewidth=2, linestyle="--",
             marker="o", markersize=5, label="Median forecast", zorder=4)

    # Low / high quantile lines
    ax1.plot(fore_x, lows,   color="#ef4444", linewidth=1, linestyle=":", label="10th pct", zorder=3)
    ax1.plot(fore_x, highs,  color="#22c55e", linewidth=1, linestyle=":", label="90th pct", zorder=3)

    # Actual future prices
    if future:
        ax1.plot(future_x, future[:n_fore], color="#a78bfa", linewidth=2,
                 marker="s", markersize=5, label="Actual (what happened)", zorder=5)

    # Divider line
    ax1.axvline(x=n_hist - 0.5, color="#334155", linewidth=1.5, linestyle="-", zorder=1)
    ax1.text(n_hist - 0.5, ax1.get_ylim()[0], " forecast →", color="#64748b",
             fontsize=8, va="bottom")

    ax1.set_title("Chronos-2-small — Memecoin Forecast Test", color="#f1f5f9",
                  fontsize=14, fontweight="bold", pad=12)
    ax1.set_ylabel("Price (USD)", color="#94a3b8", fontsize=10)
    ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"${x:.6f}"))
    ax1.legend(facecolor="#0f1826", edgecolor="#1e2a3a", labelcolor="#94a3b8", fontsize=9)
    ax1.grid(color="#1e2a3a", linewidth=0.5, alpha=0.5)

    # ── RSI subplot ──
    rsi = generate_rsi(history)
    ax2.plot(hist_x, rsi, color="#60a5fa", linewidth=1.2, label="RSI(14)")
    ax2.axhline(y=70, color="#ef4444", linewidth=0.8, linestyle="--", alpha=0.6)
    ax2.axhline(y=30, color="#22c55e", linewidth=0.8, linestyle="--", alpha=0.6)
    ax2.fill_between(hist_x, rsi, 30, where=[r < 30 for r in rsi],
                     color="#22c55e", alpha=0.2, label="Oversold")
    ax2.fill_between(hist_x, rsi, 70, where=[r > 70 for r in rsi],
                     color="#ef4444", alpha=0.2, label="Overbought")
    ax2.set_ylim(0, 100)
    ax2.set_ylabel("RSI", color="#94a3b8", fontsize=9)
    ax2.set_xlabel("Candle (5-min intervals)", color="#94a3b8", fontsize=9)
    ax2.legend(facecolor="#0f1826", edgecolor="#1e2a3a", labelcolor="#94a3b8", fontsize=8)
    ax2.grid(color="#1e2a3a", linewidth=0.5, alpha=0.5)
    ax2.axvline(x=n_hist - 0.5, color="#334155", linewidth=1.5, linestyle="-")

    plt.tight_layout(pad=2.0)
    plt.savefig(out_path, dpi=150, bbox_inches="tight", facecolor="#080c14")
    print(f"\n  Chart saved → {out_path}")


# ── 5. Main ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    N_HISTORY = 60   # 60 candles = 5 hours of history
    N_FUTURE  = 3    # 3 candles = 15 min actual future to compare against

    print("=" * 60)
    print("  Chronos-2-small — Local Test")
    print(f"  Context: {N_HISTORY} × 5min candles")
    print(f"  Forecast: {N_FUTURE} steps ahead (15 min)")
    print("=" * 60)

    history, future = generate_memecoin_prices(N_HISTORY, N_FUTURE, seed=42)
    rsi_history     = generate_rsi(history)
    lows, medians, highs = run_forecast(history, rsi_history, prediction_length=N_FUTURE)

    print_results(history, future, lows, medians, highs)
    render_chart(history, future, lows, medians, highs)

    print("\n✅ Test complete.\n")
```
