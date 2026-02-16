/**
 * polling-loop.ts
 * Polling loop for continuous token scanning
 * Uses Jupiter category endpoints for efficient token discovery
 */

import { jupiter } from "../services/jupiter";
import { scanner } from "../services/scanner";
import { SCAN_CONFIG } from "../server/config";

let isRunning = false;

/**
 * Start the optimized polling system
 * Uses different intervals for different scanning strategies
 */
export function startOptimizedPolling(): void {
    if (isRunning) return;

    console.log("[Polling] Starting optimized category-based scanning...");
    isRunning = true;

    // Run initial scan
    runScan();

    // Every 60 seconds: Check 1h organic tokens (main strategy)
    setInterval(async () => {
        await scanEstablished();
    }, SCAN_CONFIG.established.scanFrequency);

    // Every 5 minutes: Check 5m trending (early signals)
    setInterval(async () => {
        await scanEarlyMomentum();
    }, SCAN_CONFIG.earlySignals.scanFrequency);

    // Every 15 minutes: Check 6h organic (mature tokens)
    setInterval(async () => {
        await scanMature();
    }, SCAN_CONFIG.mature.scanFrequency);
}

/**
 * Scan established tokens (400-600 holders, 1h organic)
 * This is the main strategy
 */
async function scanEstablished(): Promise<void> {
    console.log("[Polling] Scanning 1h organic tokens...");

    try {
        const organicTokens = await jupiter.getOrganicTokens(
            SCAN_CONFIG.established.interval,
            SCAN_CONFIG.established.limit
        );

        for (const tokenAddress of organicTokens) {
            const token = await scanner.analyzeToken(tokenAddress);

            if (!token) continue;

            // Check if token meets our criteria
            if (token.holders >= SCAN_CONFIG.established.minHolders &&
                token.holders <= SCAN_CONFIG.established.maxHolders &&
                token.score >= SCAN_CONFIG.established.minScore) {

                console.log(`🎯 HIGH SCORE: ${token.symbol} - Score ${token.score}`);

                // TODO: Enable when database service is implemented
                // await db.saveToken(token);

                // TODO: Enable when telegram alerts are implemented
                // if (token.score >= 8) {
                //     await sendTelegramAlert(
                //         `🎯 ${token.symbol}\nScore: ${token.score}\nHolders: ${token.holders}\nPrice: $${token.price}`
                //     );
                // }
            }
        }
    } catch (error) {
        console.error("[Polling] Error scanning established tokens:", error);
    }
}

/**
 * Scan early momentum tokens (250-400 holders, 5m trending)
 * Catch tokens before they reach our target range
 */
async function scanEarlyMomentum(): Promise<void> {
    console.log("[Polling] Scanning 5m trending tokens...");

    try {
        const trendingTokens = await jupiter.getTrendingTokens(
            SCAN_CONFIG.earlySignals.interval,
            SCAN_CONFIG.earlySignals.limit
        );

        // Look for tokens that might hit 400 holders soon
        for (const tokenAddress of trendingTokens) {
            const token = await scanner.analyzeToken(tokenAddress);

            if (!token) continue;

            if (token.holders >= SCAN_CONFIG.earlySignals.minHolders &&
                token.holders < SCAN_CONFIG.earlySignals.maxHolders) {
                console.log(`👀 WATCHING: ${token.symbol} - ${token.holders} holders (approaching target)`);

                // TODO: Enable when database service is implemented
                // await db.saveToken({ ...token, status: 'watching' });
            }
        }
    } catch (error) {
        console.error("[Polling] Error scanning early momentum:", error);
    }
}

/**
 * Scan mature tokens (600+ holders, 6h organic)
 * Look for consolidation patterns in established tokens
 */
async function scanMature(): Promise<void> {
    console.log("[Polling] Scanning 6h organic tokens...");

    try {
        const organicTokens = await jupiter.getOrganicTokens(
            SCAN_CONFIG.mature.interval,
            SCAN_CONFIG.mature.limit
        );

        // Look for consolidation patterns in mature tokens
        for (const tokenAddress of organicTokens) {
            const token = await scanner.analyzeToken(tokenAddress);

            if (!token) continue;

            if (token.holders > SCAN_CONFIG.mature.minHolders) {
                // Check if it's consolidating (potential 3rd pump setup)
                const isConsolidating = await checkConsolidation(token);

                if (isConsolidating) {
                    console.log(`📊 CONSOLIDATING: ${token.symbol} - ${token.holders} holders`);

                    // TODO: Enable when database service is implemented
                    // await db.saveToken({ ...token, status: 'consolidating' });
                }
            }
        }
    } catch (error) {
        console.error("[Polling] Error scanning mature tokens:", error);
    }
}

/**
 * Check if a token is consolidating (potential setup for next pump)
 */
async function checkConsolidation(token: any): Promise<boolean> {
    // Basic consolidation check - price within narrow range
    // TODO: Implement more sophisticated consolidation detection
    // This is a placeholder for future price analysis logic

    // For now, just return false to skip
    return false;
}

/**
 * Run initial scan on startup
 */
async function runScan(): Promise<void> {
    console.log("[Polling] Running initial scan...");
    await scanEstablished();
}

/**
 * Stop the polling loop
 */
export function stopPolling(): void {
    isRunning = false;
    console.log("[Polling] Stopped");
}
