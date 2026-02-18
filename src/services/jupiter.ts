/**
 * jupiter.ts
 * Jupiter API client for token discovery using category endpoints
 * Uses lite-api.jup.ag for all endpoints with API key
 */

import type { JupiterCategory, JupiterInterval, TokenCandidate, JupiterTokenFull, JupiterTokenPrice, TokenShieldWarning } from '../types/token';

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

export const jupiter = new JupiterClient();
