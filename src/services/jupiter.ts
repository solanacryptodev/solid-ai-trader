/**
 * jupiter.ts
 * Jupiter API client for token discovery using category endpoints
 * Uses lite-api.jup.ag for all endpoints with API key
 */

import type { JupiterCategory, JupiterInterval, TokenCandidate, JupiterTokenFull, JupiterTokenPrice, TokenShieldWarning, TokenStats } from '../types/token';

const JUPITER_LITE_API_URL = "https://lite-api.jup.ag";
const JUPITER_API_KEY = 'https://de65e03f-ab1e-476f-9c09-a525efd7ec21-api.jup.ag/tokens/v2/';
const JUPITER_STATS_URL = "https://lite-api.jup.ag/tokens/v2";

export type StatWindow = "5m" | "1h" | "6h" | "24h";

export class JupiterClient {

    /**
     * Get tokens by category and interval
     * Returns full token objects from Jupiter lite API
     */
    async getTokensByCategory(
        category: JupiterCategory,
        interval: JupiterInterval = '1h',
        limit: number = 100
    ): Promise<JupiterTokenFull[]> {
        try {
            const url = `${JUPITER_LITE_API_URL}/tokens/v2/${category}/${interval}?limit=${limit}`;
            console.log('[Jupiter] Fetching:', url);

            const headers: Record<string, string> = {};
            headers['x-api-key'] = JUPITER_API_KEY;

            const response = await fetch(url, { headers });

            if (!response.ok) {
                console.error(`Jupiter Category API error: ${response.status}`);
                return [];
            }

            const data = await response.json();
            return data || [];

        } catch (error) {
            console.error(`Error fetching ${category} tokens:`, error);
            return [];
        }
    }

    /**
     * Get organic score tokens specifically
     * These are highest quality: holders + volume + liquidity
     */
    async getOrganicTokens(interval: JupiterInterval = '1h', limit: number = 100): Promise<JupiterTokenFull[]> {
        return await this.getTokensByCategory('toporganicscore', interval, limit);
    }

    /**
     * Get trending tokens
     * These might catch early second pumps
     */
    async getTrendingTokens(interval: JupiterInterval = '1h', limit: number = 50): Promise<JupiterTokenFull[]> {
        return this.getTokensByCategory('toptrending', interval, limit);
    }

    /**
     * Get most traded tokens
     * High volume = active interest
     */
    async getTopTradedTokens(interval: JupiterInterval = '1h', limit: number = 50): Promise<JupiterTokenFull[]> {
        return this.getTokensByCategory('toptraded', interval, limit);
    }

    /**
     * Calculate token confidence levels from Jupiter swap API
     */
    async getTokenConfidence(tokenAddresses: string[]): Promise<JupiterTokenPrice | null> {
        try {
            if (tokenAddresses.length === 0) return null;

            const ids = tokenAddresses.join(',');
            const response = await fetch(`${JUPITER_LITE_API_URL}/price/v2?ids=${ids}`);
            console.log(response);

            if (!response.ok) return null;

            const data: JupiterTokenPrice = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching token prices:', error);
            return null;
        }
    }

    /**
     * Get detailed token info from Jupiter lite search API
     */
    async getTokenInfo(mintAddress: string): Promise<JupiterTokenFull | null> {
        try {
            const headers: Record<string, string> = {};
            headers['x-api-key'] = JUPITER_API_KEY;

            const url = `${JUPITER_LITE_API_URL}/tokens/v2/search?query=${mintAddress}`;
            const response = await fetch(url, { headers });

            if (!response.ok) {
                console.error(`Jupiter Search API error: ${response.status}`);
                return null;
            }

            const tokens: JupiterTokenFull[] = await response.json();
            return tokens[0] || null;
        } catch (error) {
            console.error("Error fetching token info:", error);
            return null;
        }
    }

    /**
     * Get token shield warnings from Jupiter Ultra API
     * Filters tokens through security checks and returns warnings
     */
    async getTokenShield(mintAddress: string): Promise<TokenShieldWarning[]> {
        try {
            const headers: Record<string, string> = {};
            headers['x-api-key'] = JUPITER_API_KEY;

            const url = `${JUPITER_LITE_API_URL}/ultra/v1/shield?mints=${mintAddress}`;
            const response = await fetch(url, { headers });

            if (!response.ok) {
                console.error(`Jupiter Shield API error: ${response.status}`);
                return [];
            }

            const data = await response.json();
            // console.log("[Jupiter Shield] Response:", data);

            // Response structure: data.warnings[mintAddress] = [warning1, warning2, ...]
            if (data && data.warnings && data.warnings[mintAddress]) {
                return data.warnings[mintAddress] as TokenShieldWarning[];
            }

            return [];
        } catch (error) {
            console.error("Error fetching token shield:", error);
            return [];
        }
    }
}

// ── Jupiter Token Stats ────────────────────────────────────────────────────────

/**
 * Fetch trading volume and holder data for a token from Jupiter's category API.
 * Used by the trading agent as a volume gate before entering positions.
 *
 * @param mintAddress  Solana token mint address
 * @param window       Time window — "5m" | "1h" | "6h" | "24h" (default: "5m")
 * @returns TokenStats or null if the token is not found / request fails
 *
 * @example
 * const stats = await getTokenStats("So111...112", "5m");
 * if (!stats || stats.buyVolume < 10_000) return "WAIT";
 */
export async function getTokenStats(
    mintAddress: string,
    window: StatWindow = "5m"
): Promise<TokenStats | null> {
    try {
        const url = `${JUPITER_STATS_URL}/${mintAddress}`;
        const headers: Record<string, string> = {};
        headers['x-api-key'] = JUPITER_API_KEY;

        const res = await fetch(url, { headers });

        if (!res.ok) {
            console.warn(`[Jupiter] Stats fetch failed → ${res.status} for ${mintAddress}`);
            return null;
        }

        const json = await res.json();

        // Jupiter returns stats keyed by window e.g. stats5m, stats1h, stats6h, stats24h
        const key = `stats${window}` as keyof typeof json;
        const raw = json[key];

        if (!raw) {
            console.warn(`[Jupiter] No ${window} stats available for ${mintAddress}`);
            return null;
        }

        const stats: TokenStats = {
            priceChange: raw.priceChange ?? 0,
            holderChange: raw.holderChange ?? undefined,
            liquidityChange: raw.liquidityChange ?? 0,
            volumeChange: raw.volumeChange ?? 0,

            // Buy metrics
            buyVolume: raw.buyVolume ?? 0,
            buyOrganicVolume: raw.buyOrganicVolume ?? 0,
            numBuys: raw.numBuys ?? 0,
            numOrganicBuyers: raw.numOrganicBuyers ?? 0,

            // Sell metrics
            sellVolume: raw.sellVolume ?? 0,
            sellOrganicVolume: raw.sellOrganicVolume ?? 0,
            numSells: raw.numSells ?? 0,

            // Trading metrics
            numTraders: raw.numTraders ?? 0,
            numNetBuyers: raw.numNetBuyers ?? 0,
        };

        console.log(
            `[Jupiter] Stats (${window}) → ${json.symbol ?? mintAddress.slice(0, 8)} | ` +
            `buys: ${stats.numBuys} sells: ${stats.numSells} | ` +
            `organic buyers: ${stats.numOrganicBuyers} | ` +
            `buy vol: $${stats.buyVolume.toFixed(0)}`
        );

        return stats;

    } catch (err) {
        console.error(`[Jupiter] getTokenStats error [${mintAddress}]:`, err);
        return null;
    }
}

/**
 * Volume gate check — call this before any trade entry.
 * Returns true if the token has enough real activity to trade.
 *
 * Thresholds are conservative starting points — tune after 20-30 trades.
 */
export function passesVolumeGate(stats: TokenStats): {
    passes: boolean;
    reason?: string;
} {
    const totalVolume = stats.buyVolume + stats.sellVolume;
    const buyRatio = stats.numBuys / Math.max(stats.numBuys + stats.numSells, 1);

    if (totalVolume < 5_000)
        return { passes: false, reason: `total volume too low ($${totalVolume.toFixed(0)})` };

    if (stats.numOrganicBuyers < 5)
        return { passes: false, reason: `insufficient organic buyers (${stats.numOrganicBuyers})` };

    if (buyRatio < 0.45)
        return { passes: false, reason: `sell pressure too high (buy ratio ${(buyRatio * 100).toFixed(0)}%)` };

    if ((stats.holderChange ?? 0) < -10)
        return { passes: false, reason: `holders leaving fast (${stats.holderChange})` };

    if (stats.liquidityChange < -15)
        return { passes: false, reason: `liquidity draining (${stats.liquidityChange.toFixed(1)}%)` };

    return { passes: true };
}

/**
 * Check if a token qualifies as "low volume" —
 * still tradeable but warrants a smaller position and faster exit.
 */
export function isLowVolume(stats: TokenStats): boolean {
    const totalVolume = stats.buyVolume + stats.sellVolume;
    return totalVolume < 25_000 || stats.numOrganicBuyers < 15;
}

// TODO: Add Jupiter swap functionality to buy and sell tokens

export const jupiter = new JupiterClient();
