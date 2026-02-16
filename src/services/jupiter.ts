/**
 * jupiter.ts
 * Jupiter API client for token discovery using category endpoints
 * Uses lite-api.jup.ag for all endpoints with API key
 */

import type { JupiterCategory, JupiterInterval, TokenCandidate, JupiterTokenFull } from '../types/token';

const JUPITER_LITE_API_URL = "https://lite-api.jup.ag";
const JUPITER_API_KEY = 'https://de65e03f-ab1e-476f-9c09-a525efd7ec21-api.jup.ag/tokens/v2/';

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
     * Get current prices for multiple tokens
     */
    async getPrices(tokenAddresses: string[]): Promise<Record<string, number>> {
        try {
            if (tokenAddresses.length === 0) return {};

            const ids = tokenAddresses.join(',');
            const response = await fetch(`https://price.jup.ag/v6/price?ids=${ids}`);

            if (!response.ok) return {};

            const data = await response.json();
            const prices: Record<string, number> = {};

            for (const [address, info] of Object.entries(data.data || {})) {
                prices[address] = (info as any).price || 0;
            }

            return prices;
        } catch (error) {
            console.error('Error fetching prices:', error);
            return {};
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
}

export const jupiter = new JupiterClient();
