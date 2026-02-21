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
} from "~/libs/priceStore";

// Start polling when this module loads (server startup)
startPolling();

export async function GET(_event: APIEvent) {
    const states = getAllTokenStates().map((s) => ({
        mintAddress: s.mintAddress,
        label: s.label ?? s.mintAddress.slice(0, 8) + "...",
        price: s.samples.at(-1)?.price ?? null,
        liquidity: s.samples.at(-1)?.liquidity ?? null,
        priceChange24h: s.samples.at(-1)?.priceChange24h ?? null,
        rsi: s.rsi,
        forecast: s.forecast,
        candleCount: s.candles.length,
        sampleCount: s.samples.length,
        lastUpdated: s.lastUpdated,
        // Sparkline: last 20 close prices
        sparkline: s.candles.slice(-20).map((c) => c.close),
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