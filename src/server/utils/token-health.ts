/**
 * token-health.ts
 * Health score calculation, signals, and verdict for token analysis
 */

import type { JupiterTokenFull, TokenHealthMetrics, TokenStats } from "../../types/token";

// ============================================
// Helpers to safely access stats (Jupiter fields are optional)
// ============================================

const EMPTY_STATS: TokenStats = {
    priceChange: 0,
    liquidityChange: 0,
    volumeChange: 0,
    buyVolume: 0,
    buyOrganicVolume: 0,
    numBuys: 0,
    numOrganicBuyers: 0,
    sellVolume: 0,
    sellOrganicVolume: 0,
    numSells: 0,
    numTraders: 0,
    numNetBuyers: 0,
};

function getStats(token: JupiterTokenFull, key: "stats1h" | "stats5m" | "stats6h" | "stats24h"): TokenStats {
    return (token[key] as TokenStats) ?? EMPTY_STATS;
}

// ============================================
// Core scoring
// ============================================

export function calculateHealthMetrics(token: JupiterTokenFull): TokenHealthMetrics {
    const stats = getStats(token, "stats1h");
    const stats24h = getStats(token, "stats24h");

    // Calculate pressures
    const totalVolume = stats.buyVolume + stats.sellVolume;
    const buyPressure = totalVolume > 0 ? stats.buyVolume / totalVolume : 0;
    const sellPressure = totalVolume > 0 ? stats.sellVolume / totalVolume : 0;
    const netVolume = stats.buyVolume - stats.sellVolume;

    // Calculate liquidity ratio
    const liquidity = token.liquidity ?? 0;
    const volumeToLiquidityRatio = liquidity > 0 ? totalVolume / liquidity : 0;

    // Calculate health score (0-100)
    const healthScore = calculateHealthScore(token);

    return {
        // Identity
        mint: token.id,
        name: token.name,
        symbol: token.symbol,

        // Price & Liquidity
        price: token.usdPrice ?? 0,
        liquidity,
        marketCap: token.mcap ?? 0,

        // Holders
        holderCount: token.holderCount ?? 0,
        holderChange1h: stats.holderChange,

        // Trading Activity
        buyVolume: stats.buyVolume,
        sellVolume: stats.sellVolume,
        totalVolume,

        // Pressure
        buyPressure,
        sellPressure,
        netVolume,

        // Transactions
        numBuys: stats.numBuys,
        numSells: stats.numSells,
        totalTransactions: stats.numBuys + stats.numSells,

        // Quality
        netBuyers: stats.numNetBuyers,
        organicBuyers: stats.numOrganicBuyers,
        organicBuyVolume: stats.buyOrganicVolume,
        organicScore: token.organicScore ?? 0,
        organicScoreLabel: token.organicScoreLabel ?? "low",

        // Liquidity Health
        volumeToLiquidityRatio,
        liquidityChange: stats.liquidityChange,

        // Price Movement
        priceChange1h: stats.priceChange,
        priceChange24h: stats24h.priceChange,

        // Security
        mintAuthorityDisabled: token.audit?.mintAuthorityDisabled ?? false,
        freezeAuthorityDisabled: token.audit?.freezeAuthorityDisabled ?? false,

        // Launchpad
        launchpad: token.launchpad,
        graduatedAt: token.graduatedAt,

        // Overall
        healthScore,
        verdict: getVerdict(healthScore),
    };
}

export function calculateHealthScore(token: JupiterTokenFull): number {
    const stats = getStats(token, "stats1h");
    let score = 0;

    // 1. Buy Pressure (0-25 points)
    const totalVol = stats.buyVolume + stats.sellVolume;
    const buyPressure = totalVol > 0 ? stats.buyVolume / totalVol : 0;
    if (buyPressure > 0.65) score += 25;
    else if (buyPressure > 0.55) score += 20;
    else if (buyPressure > 0.45) score += 10;
    else if (buyPressure < 0.35) score += 0; // Heavy selling

    // 2. Liquidity Health (0-20 points)
    const liquidity = token.liquidity ?? 0;
    if (liquidity > 100_000) score += 20;
    else if (liquidity > 50_000) score += 15;
    else if (liquidity > 20_000) score += 10;
    else if (liquidity > 10_000) score += 5;

    // 3. Volume/Liquidity Ratio (0-15 points)
    const volToLiq = liquidity > 0 ? totalVol / liquidity : 0;
    if (volToLiq > 3 && volToLiq < 20) score += 15; // Sweet spot
    else if (volToLiq > 1 && volToLiq < 50) score += 10;
    else if (volToLiq > 50) score += 0; // Too volatile

    // 4. Organic Score (0-15 points)
    if (token.organicScoreLabel === "high") score += 15;
    else if (token.organicScoreLabel === "medium") score += 8;
    else score += 0;

    // 5. Net Buyers (0-10 points)
    if (stats.numNetBuyers > 500) score += 10;
    else if (stats.numNetBuyers > 200) score += 7;
    else if (stats.numNetBuyers > 50) score += 5;
    else if (stats.numNetBuyers < 0) score += 0; // Net sellers

    // 6. Holder Count (0-10 points)
    const holderCount = token.holderCount ?? 0;
    if (holderCount > 1000) score += 10;
    else if (holderCount > 500) score += 7;
    else if (holderCount > 100) score += 5;

    // 7. Security (0-5 points)
    if (token.audit?.mintAuthorityDisabled && token.audit?.freezeAuthorityDisabled) {
        score += 5;
    }

    return Math.min(score, 100); // Cap at 100
}

export function getVerdict(score: number): "healthy" | "risky" | "red-flag" {
    if (score >= 70) return "healthy";
    if (score >= 40) return "risky";
    return "red-flag";
}

export function isTokenHealthy(token: JupiterTokenFull): boolean {
    const stats = getStats(token, "stats1h");
    const totalVol = stats.buyVolume + stats.sellVolume;
    const buyPressure = totalVol > 0 ? stats.buyVolume / totalVol : 0;
    const liquidity = token.liquidity ?? 0;
    const volToLiq = liquidity > 0 ? totalVol / liquidity : 0;

    return (
        buyPressure > 0.55 &&
        liquidity > 20_000 &&
        stats.numNetBuyers > 50 &&
        (token.organicScore ?? 0) > 70 &&
        volToLiq > 1 &&
        volToLiq < 50 &&
        (token.audit?.mintAuthorityDisabled ?? false) &&
        (token.audit?.freezeAuthorityDisabled ?? false) &&
        (token.holderCount ?? 0) > 100
    );
}

export function generateSignals(metrics: TokenHealthMetrics): string[] {
    const signals: string[] = [];

    if (metrics.buyPressure > 0.7) {
        signals.push("🟢 STRONG BUY PRESSURE");
    }
    if (metrics.netBuyers > 200) {
        signals.push("🟢 GROWING HOLDER BASE");
    }
    if (metrics.organicScoreLabel === "high") {
        signals.push("🟢 HIGH ORGANIC SCORE");
    }
    if (metrics.liquidityChange > 0.2) {
        signals.push("🟢 LIQUIDITY INCREASING");
    }

    if (metrics.buyPressure < 0.4) {
        signals.push("🔴 HEAVY SELLING");
    }
    if (metrics.netBuyers < 0) {
        signals.push("🔴 NET SELLERS");
    }
    if (metrics.volumeToLiquidityRatio > 30) {
        signals.push("🟡 HIGH VOLATILITY");
    }
    if (!metrics.mintAuthorityDisabled || !metrics.freezeAuthorityDisabled) {
        signals.push("🔴 SECURITY RISK");
    }

    return signals;
}

/**
 * Full analysis helper — useful for debugging in console
 */
export function analyzeYourToken(token: JupiterTokenFull) {
    const stats = getStats(token, "stats1h");
    const metrics = calculateHealthMetrics(token);

    return {
        summary: {
            name: token.name,
            symbol: token.symbol,
            price: `$${(token.usdPrice ?? 0).toFixed(8)}`,
            liquidity: `$${(token.liquidity ?? 0).toLocaleString()}`,
            healthScore: `${metrics.healthScore}/100`,
            verdict: metrics.verdict,
        },

        trading: {
            buyVolume: `$${stats.buyVolume.toLocaleString()}`,
            sellVolume: `$${stats.sellVolume.toLocaleString()}`,
            buyPressure: `${(metrics.buyPressure * 100).toFixed(1)}%`,
            netBuying:
                metrics.netVolume > 0
                    ? `+$${metrics.netVolume.toLocaleString()}`
                    : `-$${Math.abs(metrics.netVolume).toLocaleString()}`,
            transactions: `${metrics.numBuys} buys / ${metrics.numSells} sells`,
        },

        quality: {
            organicScore: `${(token.organicScore ?? 0).toFixed(1)} (${token.organicScoreLabel ?? "low"})`,
            netBuyers: stats.numNetBuyers,
            organicBuyers: stats.numOrganicBuyers,
            holders: token.holderCount ?? 0,
        },

        liquidity: {
            total: `$${(token.liquidity ?? 0).toLocaleString()}`,
            volumeRatio: `${metrics.volumeToLiquidityRatio.toFixed(2)}x`,
            change: `${(stats.liquidityChange * 100).toFixed(2)}%`,
            stability:
                metrics.volumeToLiquidityRatio < 10
                    ? "Stable"
                    : metrics.volumeToLiquidityRatio < 30
                        ? "Moderate"
                        : "Volatile",
        },

        security: {
            mintDisabled: token.audit?.mintAuthorityDisabled ? "✅" : "❌",
            freezeDisabled: token.audit?.freezeAuthorityDisabled ? "✅" : "❌",
            launchpad: token.launchpad || "Unknown",
            graduated: token.graduatedAt ? "✅" : "No",
        },

        signals: generateSignals(metrics),
    };
}
