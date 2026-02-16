/**
 * scanner.ts
 * Token scanner service using Jupiter category endpoints
 * Filters for second pump candidates based on holder count and score
 */

import { jupiter } from "./jupiter";
import type { TokenCandidate, JupiterInterval, JupiterTokenFull } from "../types/token";
import { SCAN_CONFIG } from "../server/config";
import { calculateHealthScore, calculateHealthMetrics, generateSignals } from "../server/utils/token-health";

const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_RPC_URL || "";

console.log("[Scanner] HELIUS_API_KEY loaded:", HELIUS_API_KEY ? "YES (key present)" : "NO");

export class TokenScanner {

    /**
     * Main scanning strategy using Jupiter's category endpoints
     */
    async scanForCandidates(): Promise<TokenCandidate[]> {
        console.log("[Scanner] Starting category-based scan...");

        try {
            const candidates: TokenCandidate[] = [];

            // Strategy 1: Get organic score tokens (1h interval)
            // These have good holders + volume + liquidity
            const organicTokens = await jupiter.getOrganicTokens("1h", 100);
            console.log(`[Scanner] Found ${organicTokens.length} organic tokens`);

            // Strategy 2: Get trending tokens (5m interval for early catches)
            const trendingTokens = await jupiter.getTrendingTokens("5m", 50);
            console.log(`[Scanner] Found ${trendingTokens.length} trending tokens`);

            // Combine and deduplicate by id
            const tokenMap = new Map<string, JupiterTokenFull>();
            for (const token of [...organicTokens, ...trendingTokens]) {
                tokenMap.set(token.id, token);
            }
            const allTokens = Array.from(tokenMap.values());
            console.log(`[Scanner] Checking ${allTokens.length} unique tokens`);

            // Check each token for your specific criteria
            for (const token of allTokens) {
                try {
                    const candidate = await this.analyzeToken(token);

                    // Filter: 400-600 holders, score >= 70
                    if (candidate &&
                        candidate.holders >= 400 &&
                        candidate.holders <= 600 &&
                        candidate.score >= 70) {
                        candidates.push(candidate);
                        console.log(`[Scanner] ✅ ${candidate.symbol}: Score ${candidate.score}, ${candidate.holders} holders`);
                    }
                } catch (error) {
                    console.error(`[Scanner] Error analyzing ${token.id}:`, error);
                }
            }

            console.log(`[Scanner] Found ${candidates.length} high-quality candidates`);
            return candidates;

        } catch (error) {
            console.error("[Scanner] Scan failed:", error);
            return [];
        }
    }

    /**
     * Alternative: Multi-interval scanning for different stages
     */
    async scanMultiInterval(): Promise<{
        earlyStage: TokenCandidate[];
        established: TokenCandidate[];
        mature: TokenCandidate[];
    }> {
        const results = {
            earlyStage: [] as TokenCandidate[],
            established: [] as TokenCandidate[],
            mature: [] as TokenCandidate[],
        };

        // Early momentum (might not have 400 holders yet, but watch them)
        const early5m = await jupiter.getTrendingTokens("5m", 30);
        for (const token of early5m) {
            const candidate = await this.analyzeToken(token);
            if (candidate && candidate.holders >= 100 && candidate.holders < 400) {
                results.earlyStage.push(candidate);
            }
        }

        // Your target: established tokens (400-600 holders, 1h window)
        const organic1h = await jupiter.getOrganicTokens("1h", 100);
        for (const token of organic1h) {
            const candidate = await this.analyzeToken(token);
            if (candidate && candidate.holders >= 400 && candidate.holders <= 600) {
                results.established.push(candidate);
            }
        }

        // Mature tokens (might be setting up for 3rd pump)
        const organic6h = await jupiter.getOrganicTokens("6h", 50);
        for (const token of organic6h) {
            const candidate = await this.analyzeToken(token);
            if (candidate && candidate.holders > 600) {
                results.mature.push(candidate);
            }
        }

        return results;
    }

    /**
     * Analyze a single token for second pump eligibility
     * Accepts either a JupiterTokenFull object or a string address
     */
    async analyzeToken(tokenAddress: JupiterTokenFull | string): Promise<TokenCandidate | null> {
        try {
            // If we already have the full token object, use it directly
            let jupiterInfo: JupiterTokenFull | null;

            if (typeof tokenAddress === 'object' && tokenAddress !== null && 'id' in tokenAddress) {
                // Already have the full Jupiter token object
                jupiterInfo = tokenAddress as JupiterTokenFull;
                // console.log("[Scanner] Using provided token data:", jupiterInfo.id);
            } else {
                // It's a string address, need to fetch token info
                const address = tokenAddress as string;
                // console.log("[Scanner] Fetching token info for:", address);
                jupiterInfo = await jupiter.getTokenInfo(address);
            }

            if (!jupiterInfo) {
                console.log(`[Scanner] Token not found in Jupiter`);
                return null;
            }

            // Extract holder count from Jupiter response
            const holderCount = jupiterInfo.holderCount || 0;
            // console.log(`[Scanner] Token ${jupiterInfo.id} has ${holderCount} holders`);

            if (holderCount < 100) {
                // console.log(`[Scanner] Token ${jupiterInfo.id} has only ${holderCount} holders, skipping`);
                return null;
            }

            // Use price from Jupiter data
            const price = jupiterInfo.usdPrice || 0;

            // Calculate health score (0-100) and generate signals
            const score = this.calculateScore(holderCount, jupiterInfo);
            const metrics = calculateHealthMetrics(jupiterInfo);
            const signals = generateSignals(metrics);

            return {
                address: jupiterInfo,
                symbol: jupiterInfo.symbol || "UNKNOWN",
                name: jupiterInfo.name || "Unknown Token",
                holders: holderCount,
                score,
                price,
                liquidity: jupiterInfo.liquidity || 0,
                marketCap: jupiterInfo.mcap || 0,
                status: "watching",
                signals,
                verdict: metrics.verdict,
            };
        } catch (error) {
            console.error(`[Scanner] Error analyzing token:`, error);
            return null;
        }
    }

    /**
     * Calculate score based on holder count and token info (0-100)
     */
    private calculateScore(holderCount: number, tokenInfo: JupiterTokenFull): number {
        return calculateHealthScore(tokenInfo);
    }
}

export const scanner = new TokenScanner();

