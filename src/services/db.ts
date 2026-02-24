/**
 * db.ts
 * MongoDB integration for Solana memecoin trading system.
 * Stores trade records, signals, and forecasts.
 *
 * Install:
 *   npm install mongodb
 *
 * Usage:
 *   import { db } from "./db";
 *   await db.connect();
 *   await db.openTrade(tradeRecord);
 *   await db.getRecentTrades(100);
 */

import { MongoClient, Collection, Db, ObjectId, ServerApiVersion } from "mongodb";
import type { TradeRecord, SignalRecord, ForecastRecord, PerformanceSummary } from "~/libs/interfaces";

// ── Connection ─────────────────────────────────────────────────────────────────

const MONGO_URI = process.env.MONGO_URI as string;
const DB_NAME = process.env.MONGO_DB as string;
const MAX_TRADES = 100; // rolling window — agent learns from recent history only

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectDB(): Promise<void> {
    if (client) return; // already connected
    client = new MongoClient(MONGO_URI, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    });

    await client.connect();
    database = client.db(DB_NAME);
    console.log(`[DB] Connected to MongoDB → ${DB_NAME}`);
    await ensureIndexes();
}

export async function disconnectDB(): Promise<void> {
    if (client) {
        await client.close();
        client = null;
        database = null;
        console.log("[DB] Disconnected from MongoDB");
    }
}

function getDB(): Db {
    if (!database) throw new Error("[DB] Not connected — call connectDB() first");
    return database;
}

// ── Collections ────────────────────────────────────────────────────────────────

function trades(): Collection<TradeRecord> {
    return getDB().collection("trades");
}
function signals(): Collection<SignalRecord> {
    return getDB().collection("signals");
}
function forecasts(): Collection<ForecastRecord> {
    return getDB().collection("forecasts");
}

// ── Indexes ────────────────────────────────────────────────────────────────────

async function ensureIndexes(): Promise<void> {
    // Trades — common query patterns
    await trades().createIndex({ mintAddress: 1, timestamp: -1 });
    await trades().createIndex({ timestamp: -1 });
    await trades().createIndex({ exitPrice: 1 }); // find open trades
    await trades().createIndex({ profitable: 1 }); // win rate queries
    await trades().createIndex({ network: 1 }); // devnet vs mainnet

    // Signals
    await signals().createIndex({ mintAddress: 1, timestamp: -1 });
    await signals().createIndex({ signal: 1, timestamp: -1 });

    // Forecasts
    await forecasts().createIndex({ mintAddress: 1, timestamp: -1 });
    await forecasts().createIndex({ confidence: -1 });

    console.log("[DB] Indexes ensured");
}

// ── Trade Operations ───────────────────────────────────────────────────────────

/** Open a new trade — exitPrice is null until closed */
export async function openTrade(trade: Omit<TradeRecord, "_id">): Promise<string> {
    const result = await trades().insertOne(trade);

    // Enforce rolling 100 trade limit — delete oldest if over cap
    const count = await trades().countDocuments({ network: trade.network });
    if (count > MAX_TRADES) {
        const oldest = await trades()
            .find({ network: trade.network })
            .sort({ timestamp: 1 })
            .limit(count - MAX_TRADES)
            .toArray();
        const ids = oldest.map((t) => t._id!);
        await trades().deleteMany({ _id: { $in: ids } });
    }

    console.log(`[DB] Trade opened → ${trade.token} @ $${trade.entryPrice}`);
    return result.insertedId.toString();
}

/** Close an existing trade with outcome */
export async function closeTrade(
    tradeId: string,
    exit: {
        exitPrice: number;
        exitReason: TradeRecord["exitReason"];
        holdMinutes: number;
    }
): Promise<void> {
    const trade = await trades().findOne({ _id: new ObjectId(tradeId) });
    if (!trade) throw new Error(`[DB] Trade not found: ${tradeId}`);

    const pnlPct = ((exit.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
    const profitable = pnlPct > 0;

    await trades().updateOne(
        { _id: new ObjectId(tradeId) },
        {
            $set: {
                exitPrice: exit.exitPrice,
                exitTime: new Date(),
                exitReason: exit.exitReason,
                holdMinutes: exit.holdMinutes,
                pnlPct: parseFloat(pnlPct.toFixed(4)),
                profitable,
            },
        }
    );

    console.log(
        `[DB] Trade closed → ${trade.token} | P&L: ${pnlPct.toFixed(2)}% | Reason: ${exit.exitReason}`
    );
}

/** Get all currently open trades */
export async function getOpenTrades(network: "devnet" | "mainnet" = "devnet"): Promise<TradeRecord[]> {
    return trades()
        .find({ exitPrice: { $exists: false }, network })
        .sort({ timestamp: -1 })
        .toArray();
}

/** Get recent closed trades — agent uses these for pattern learning */
export async function getRecentTrades(
    limit = 100,
    network: "devnet" | "mainnet" = "devnet"
): Promise<TradeRecord[]> {
    return trades()
        .find({ exitPrice: { $exists: true }, network })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
}

// ── Performance Summary ────────────────────────────────────────────────────────

/** Performance summary — agent reads this before making decisions */
export async function getPerformanceSummary(
    network: "devnet" | "mainnet" = "devnet"
): Promise<PerformanceSummary> {
    const closed = await getRecentTrades(100, network);
    if (closed.length === 0) {
        return {
            totalTrades: 0,
            winRate: 0,
            avgWinPct: 0,
            avgLossPct: 0,
            avgHoldMinutes: 0,
            avgEntryConfidence: 0,
            bestTrade: 0,
            worstTrade: 0,
            lowVolumeWinRate: 0,
            highConfWinRate: 0,
            byExitReason: {},
        };
    }

    const winners = closed.filter((t) => t.profitable);
    const losers = closed.filter((t) => !t.profitable);
    const lowVol = closed.filter((t) => t.isLowVolume);
    const highConf = closed.filter((t) => t.entryConfidence >= 0.85);

    const avg = (arr: number[]) =>
        arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    // Group by exit reason
    const byExitReason: PerformanceSummary["byExitReason"] = {};
    for (const trade of closed) {
        const reason = trade.exitReason ?? "unknown";
        if (!byExitReason[reason]) byExitReason[reason] = { count: 0, avgPnl: 0 };
        byExitReason[reason].count++;
        byExitReason[reason].avgPnl += trade.pnlPct ?? 0;
    }
    for (const reason of Object.keys(byExitReason)) {
        byExitReason[reason].avgPnl /= byExitReason[reason].count;
    }

    return {
        totalTrades: closed.length,
        winRate: parseFloat((winners.length / closed.length).toFixed(4)),
        avgWinPct: parseFloat(avg(winners.map((t) => t.pnlPct!)).toFixed(2)),
        avgLossPct: parseFloat(avg(losers.map((t) => t.pnlPct!)).toFixed(2)),
        avgHoldMinutes: parseFloat(avg(closed.map((t) => t.holdMinutes!)).toFixed(1)),
        avgEntryConfidence: parseFloat(avg(closed.map((t) => t.entryConfidence)).toFixed(4)),
        bestTrade: parseFloat(Math.max(...closed.map((t) => t.pnlPct ?? 0)).toFixed(2)),
        worstTrade: parseFloat(Math.min(...closed.map((t) => t.pnlPct ?? 0)).toFixed(2)),
        lowVolumeWinRate: parseFloat(
            (lowVol.filter((t) => t.profitable).length / Math.max(lowVol.length, 1)).toFixed(4)
        ),
        highConfWinRate: parseFloat(
            (highConf.filter((t) => t.profitable).length / Math.max(highConf.length, 1)).toFixed(4)
        ),
        byExitReason,
    };
}

// ── Signal Operations ──────────────────────────────────────────────────────────

export async function saveSignal(signal: Omit<SignalRecord, "_id">): Promise<void> {
    await signals().insertOne(signal);
}

export async function getRecentSignals(
    mintAddress: string,
    limit = 20
): Promise<SignalRecord[]> {
    return signals()
        .find({ mintAddress })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
}

// ── Forecast Operations ────────────────────────────────────────────────────────

export async function saveForecastToDB(forecast: Omit<ForecastRecord, "_id">): Promise<string> {
    const result = await forecasts().insertOne(forecast);
    return result.insertedId.toString();
}

/** Update a forecast with actual prices for accuracy tracking */
export async function resolveForecast(
    forecastId: string,
    actualPrices: number[]
): Promise<void> {
    const forecast = await forecasts().findOne({ _id: new ObjectId(forecastId) });
    if (!forecast) return;

    // Check if direction call was correct
    const lastActual = actualPrices.at(-1)!;
    const pctActual = (lastActual - forecast.forecasts[0].median) / forecast.forecasts[0].median;
    const accurate =
        (forecast.direction === "bullish" && pctActual > 0.01) ||
        (forecast.direction === "bearish" && pctActual < -0.01) ||
        (forecast.direction === "neutral" && Math.abs(pctActual) <= 0.01);

    await forecasts().updateOne(
        { _id: new ObjectId(forecastId) },
        { $set: { actualPrices, accurate } }
    );
}

// ── Convenience export ─────────────────────────────────────────────────────────

export const db = {
    connect: connectDB,
    disconnect: disconnectDB,
    openTrade,
    closeTrade,
    getOpenTrades,
    getRecentTrades,
    getPerformanceSummary,
    saveSignal,
    getRecentSignals,
    saveForecastToDB,
    resolveForecast,
};