/**
 * chronos.ts
 * Client for the Chronos-2 Python microservice
 */

import { ChronosForecastResponse, ChronosInput } from "./interfaces";

const CHRONOS_URL = process.env.CHRONOS_SERVICE_URL ?? "http://localhost:8000";

export async function getForecast(input: ChronosInput): Promise<ChronosForecastResponse | null> {
    try {
        const res = await fetch(`${CHRONOS_URL}/forecast`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prices: input.prices,
                rsi_history: input.rsi_history ?? null,
                liquidity_history: input.liquidity_history ?? null,
                volume_history: input.volume_history ?? null,
                buy_pressure: input.buy_pressure ?? null,
                prediction_length: input.prediction_length ?? 3,
                token: input.token ?? null,
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
        const res = await fetch(`${CHRONOS_URL}/health`, { signal: AbortSignal.timeout(3_000) });
        const data = await res.json();
        return data.status === "ok" && data.model_loaded === true && data.model === "chronos-2";
    } catch {
        return false;
    }
}
