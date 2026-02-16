/**
 * config.ts
 * Configuration for the token scanning system
 */

import type { JupiterInterval } from "../types/token";

export interface ScanConfig {
    interval: JupiterInterval;
    limit: number;
    minHolders: number;
    maxHolders: number;
    minScore: number;
    scanFrequency: number;
}

export const SCAN_CONFIG = {
    // Main strategy: 1h organic tokens
    established: {
        interval: '1h' as JupiterInterval,
        limit: 100,
        minHolders: 400,
        maxHolders: 600,
        minScore: 70,
        scanFrequency: 60_000, // 60 seconds
    },

    // Early momentum: 5m trending
    earlySignals: {
        interval: '5m' as JupiterInterval,
        limit: 50,
        minHolders: 250, // Watch as they approach 400
        maxHolders: 400,
        scanFrequency: 300_000, // 5 minutes
    },

    // Mature tokens: 6h organic
    mature: {
        interval: '6h' as JupiterInterval,
        limit: 50,
        minHolders: 600,
        scanFrequency: 900_000, // 15 minutes
    },
};
