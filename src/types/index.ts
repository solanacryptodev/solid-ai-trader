/**
 * types/index.ts
 * Core TypeScript interfaces for the AI trading system
 */

// Re-export token types
export * from './token';

// Trading signal types
export type TradingSignal = 'BUY' | 'SELL' | 'HOLD';

export interface TradingSignalResult {
    signal: TradingSignal;
    score: number;
    confidence: number;
}

// Order types
export interface Order {
    id: string;
    tokenAddress: string;
    type: 'BUY' | 'SELL';
    amount: number;
    price: number;
    status: 'pending' | 'filled' | 'cancelled';
    timestamp: number;
}

// Position types
export interface Position {
    tokenAddress: string;
    amount: number;
    entryPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
}

// Analysis result types
export interface AnalysisResult {
    tokenAddress: string;
    technicalSignal: TradingSignalResult;
    mlSignal?: TradingSignalResult;
    forecast?: ForecastResult;
    rugCheck?: RugCheckResult;
    finalSignal: TradingSignal;
    timestamp: number;
}

// Forecast types
export interface ForecastResult {
    currentPrice: number;
    predictions: {
        percentile10: number;
        percentile25: number;
        percentile50: number;
        percentile75: number;
        percentile90: number;
    };
    horizon: number;
    confidence: number;
}

// RugCheck types
export interface RugCheckResult {
    score: number;
    isHoneypot: boolean;
    mintAuthority: string | null;
    riskLevel: 'low' | 'medium' | 'high';
    holders: number;
    top10HolderPercent: number;
}

// Wallet types
export interface WalletInfo {
    address: string;
    solBalance: number;
    positions: Position[];
    totalValue: number;
    totalPnL: number;
}

// Config types
export interface TradingConfig {
    maxPositionSize: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    slippageBps: number;
    minLiquidity: number;
    minRugCheckScore: number;
}
