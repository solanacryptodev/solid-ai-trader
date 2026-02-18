/**
 * DeepAgent Type Definitions
 * Core types for the multi-agent trading system
 */

import type { TradingSignal } from "~/types";

// Token data passed from Watchlist
export interface TokenInput {
    address: string;
    symbol: string;
    name: string;
    icon?: string;
    price?: string;
    change?: string;
    score?: number;
    holders?: number;
}

// Base interface for all agent results
export interface AgentResult {
    agentName: string;
    success: boolean;
    timestamp: number;
    error?: string;
}

// Social Agent (Twitter) Result
export interface SocialAgentResult extends AgentResult {
    agentName: "SocialAgent";
    tweets: TweetData[];
    sentiment: SentimentAnalysis;
    mentions: number;
    trending: boolean;
}

export interface TweetData {
    id: string;
    text: string;
    author: string;
    createdAt: string;
    likes: number;
    retweets: number;
    replies: number;
}

export interface SentimentAnalysis {
    score: number; // -1 to 1
    label: "bullish" | "bearish" | "neutral";
    confidence: number;
    keyThemes: string[];
}

// Chart Agent (Technical Analysis) Result
export interface ChartAgentResult extends AgentResult {
    agentName: "ChartAgent";
    signals: TechnicalSignal[];
    indicators: IndicatorResult[];
    pattern: string | null;
}

export interface TechnicalSignal {
    indicator: string;
    signal: TradingSignal;
    strength: number;
}

export interface IndicatorResult {
    name: string;
    value: number;
    signal: TradingSignal;
}

// Model Agent (Chronos/ML) Result
export interface ModelAgentResult extends AgentResult {
    agentName: "ModelAgent";
    predictions: PricePrediction;
    confidence: number;
}

export interface PricePrediction {
    currentPrice: number;
    percentile10: number;
    percentile25: number;
    percentile50: number;
    percentile75: number;
    percentile90: number;
    horizon: number; // hours
}

// Security Agent Result
export interface SecurityAgentResult extends AgentResult {
    agentName: "SecurityAgent";
    rugCheck: RugCheckSummary;
    riskScore: number;
}

export interface RugCheckSummary {
    isHoneypot: boolean;
    mintAuthority: string | null;
    riskLevel: "low" | "medium" | "high";
    top10HolderPercent: number;
}

// Execution Agent Result
export interface ExecutionAgentResult extends AgentResult {
    agentName: "ExecutionAgent";
    recommendation: TradingSignal;
    reasoning: string;
    confidence: number;
}

// Orchestrator Request/Response
export interface OrchestratorRequest {
    token: TokenInput;
    agents?: AgentType[];
}

export type AgentType = "social" | "chart" | "model" | "security" | "execution";

export interface OrchestratorResponse {
    token: TokenInput;
    results: {
        social?: SocialAgentResult;
        chart?: ChartAgentResult;
        model?: ModelAgentResult;
        security?: SecurityAgentResult;
        execution?: ExecutionAgentResult;
    };
    finalSignal: TradingSignal;
    overallConfidence: number;
    timestamp: number;
}

// Potential token (selected from Watchlist)
export interface PotentialToken {
    id: string;
    name: string;
    symbol: string;
    icon: string;
    address: string;
}
