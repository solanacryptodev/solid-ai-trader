/**
 * tokenDiscovery.ts
 * API endpoint for token discovery using Jupiter category endpoints
 * Supports both single token check and bulk scanning
 * Endpoints: POST /api/tokenDiscovery, GET /api/tokenDiscovery
 */

import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import type { EligibleToken, TokenCandidate, JupiterTokenFull, TokenStats } from "~/types/token";
import { jupiter } from "~/services/jupiter";
import { scanner } from "~/services/scanner";

// Default eligibility thresholds
const DEFAULT_MIN_HOLDERS = 100;
const DEFAULT_MAX_AGE_HOURS = 1;

// Minimum total trades threshold (numBuys + numSells)
const MIN_TOTAL_TRADES = 100;

/**
 * Check if a token has minimum total trades (buys + sells)
 * Returns true if token meets the threshold, false otherwise
 */
function hasMinimumTrades(address: string | JupiterTokenFull, interval: string): boolean {
    // If address is just a string, we don't have stats - require minimum trades
    if (typeof address === 'string') {
        return false;
    }

    // Get stats based on interval
    const statsKey = `stats${interval}` as keyof JupiterTokenFull;
    const stats = address[statsKey] as TokenStats | undefined;

    if (!stats) {
        return false;
    }

    const totalTrades = (stats.numBuys || 0) + (stats.numSells || 0);
    return totalTrades >= MIN_TOTAL_TRADES;
}

/**
 * POST /api/tokenDiscovery
 * Check if a token meets eligibility criteria for second pump trading
 * Body: { mintAddress: string, minHolders?: number, maxAge?: number }
 */
export async function POST({ request }: APIEvent) {
    try {
        const body = await request.json();
        const { mintAddress, minHolders = DEFAULT_MIN_HOLDERS, maxAge = DEFAULT_MAX_AGE_HOURS } = body;

        if (!mintAddress) {
            return json({ success: false, error: "mintAddress is required" }, { status: 400 });
        }

        // Use the scanner to analyze the token
        const candidate = await scanner.analyzeToken(mintAddress);

        if (!candidate) {
            return json({ success: false, error: "Could not analyze token" }, { status: 404 });
        }

        // Check if token meets our criteria
        if (candidate.holders < minHolders) {
            return json({
                success: false,
                error: `Insufficient holders: ${candidate.holders} (required: ${minHolders})`,
            });
        }

        // Convert to EligibleToken format for backward compatibility
        const eligibleToken: EligibleToken = {
            mint: mintAddress,
            name: candidate.name,
            symbol: candidate.symbol,
            holderCount: candidate.holders,
            createdAt: candidate.createdAt || new Date(),
            liquidity: candidate.liquidity,
            price: candidate.price,
        };

        return json({ success: true, token: eligibleToken, candidate });
    } catch (error) {
        console.error("Token discovery error:", error);
        return json({ success: false, error: "Token discovery failed" }, { status: 500 });
    }
}

/**
 * GET /api/tokenDiscovery
 * Scan for token candidates using Jupiter category endpoints
 * Query params: ?type=organic|trending|all&interval=1h|5m|6h&limit=5&page=1
 */
export async function GET({ request }: APIEvent) {
    try {
        const url = new URL(request.url);
        const scanType = url.searchParams.get("type") || "all";
        const interval = url.searchParams.get("interval") as any || "1h";
        console.log(`[TokenDiscovery] Scanning with type=${scanType}, interval=${interval}`);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 100);
        const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);

        // console.log(`[TokenDiscovery] Scanning with type=${scanType}, interval=${interval}, limit=${limit}, page=${page}`);

        let candidates: TokenCandidate[] = [];

        switch (scanType) {
            case "organic":
                // Get organic score tokens
                const organicMints = await jupiter.getOrganicTokens(interval);
                // console.log("[TokenDiscovery] Organic mints fetched:", organicMints.length, organicMints);

                for (const mint of organicMints) {
                    // console.log("[TokenDiscovery] Analyzing mint:", mint);
                    const candidate = await scanner.analyzeToken(mint);
                    // console.log("[TokenDiscovery] Candidate result:", candidate);

                    if (candidate && candidate.holders >= 100 && candidate.holders <= 2000) {
                        // Filter: require at least 100 total trades (numBuys + numSells)
                        if (!hasMinimumTrades(candidate.address, interval)) {
                            continue;
                        }
                        candidates.push(candidate);
                    }
                }
                break;

            case "trending":
                // Get trending tokens
                const trendingMints = await jupiter.getTrendingTokens(interval);
                // console.log("[TokenDiscovery] Trending mints fetched:", trendingMints.length);

                for (const mint of trendingMints) {
                    const candidate = await scanner.analyzeToken(mint);
                    if (candidate && candidate.holders >= 250) {
                        // Filter: require at least 100 total trades (numBuys + numSells)
                        if (!hasMinimumTrades(candidate.address, interval)) {
                            continue;
                        }
                        candidates.push(candidate);
                    }
                }
                break;

            case "all":
            default:
                // Use the full scanner which combines organic + trending
                candidates = await scanner.scanForCandidates();
                break;
        }

        // console.log("[TokenDiscovery] Final candidates:", candidates.length, candidates);

        // Sort by score (highest first)
        candidates.sort((a, b) => b.score - a.score);

        // Calculate pagination
        const total = candidates.length;
        const totalPages = Math.ceil(total / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedCandidates = candidates.slice(startIndex, endIndex);
        const hasMore = page < totalPages;

        return json({
            success: true,
            count: paginatedCandidates.length,
            total,
            page,
            totalPages,
            hasMore,
            candidates: paginatedCandidates,
        });
    } catch (error) {
        console.error("Token discovery scan error:", error);
        return json({ success: false, error: String(error) }, { status: 500 });
    }
}
