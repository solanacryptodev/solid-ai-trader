/**
 * token.ts
 * TypeScript interfaces for on-chain token data and Helius/Jupiter integration
 */

/**
 * Token transfer data from Helius webhooks
 */
export interface TokenWebhookData {
    signature: string;
    type: string;
    timestamp: number;
    tokenTransfers?: Array<{
        mint: string;
        fromUserAccount?: string;
        toUserAccount?: string;
        tokenAmount: number;
    }>;
}

/**
 * Helius Digital Asset Standard (DAS) API response for token assets
 */
export interface HeliusAsset {
    id: string;
    content?: {
        metadata?: {
            created_at?: string;
            name?: string;
            symbol?: string;
        };
    };
    token_info?: {
        supply: number;
        decimals: number;
    };
}

/**
 * Token account holder information from Helius
 */
export interface TokenAccount {
    owner: string;
    amount: number;
}

// ============================================
// Time-based stats (used by stats1h, stats5m, etc.)
// ============================================

export interface TokenStats {
    priceChange: number;
    holderChange?: number;
    liquidityChange: number;
    volumeChange: number;

    // Buy Metrics
    buyVolume: number;
    buyOrganicVolume: number;
    numBuys: number;
    numOrganicBuyers: number;

    // Sell Metrics
    sellVolume: number;
    sellOrganicVolume: number;
    numSells: number;

    // Trading Metrics
    numTraders: number;
    numNetBuyers: number;
}

/**
 * Full token data from Jupiter API (returned from search endpoint)
 */
export interface JupiterTokenFull {
    id: string;
    name: string;
    symbol: string;
    icon?: string;
    decimals: number;

    // Token Info
    dev?: string;
    circSupply?: number;
    totalSupply?: number;
    holderCount?: number;
    createdAt?: string;

    // Audit Info
    audit?: {
        mintAuthorityDisabled: boolean;
        freezeAuthorityDisabled: boolean;
    };

    // Pool Info
    firstPool?: {
        id: string;
        createdAt: string;
    };
    graduatedAt?: string;
    graduatedPool?: string;
    launchpad?: string;
    dexBanner?: string;

    // Price & Market Data
    usdPrice?: number;
    priceBlockId?: number;
    liquidity?: number;
    mcap?: number;
    fdv?: number;
    fees?: number;

    // Quality Metrics
    organicScore?: number;
    organicScoreLabel?: 'high' | 'medium' | 'low';
    isVerified?: boolean;
    tags?: string[];
    tokenProgram?: string;

    // Time-based Stats
    stats1h?: TokenStats;
    stats5m?: TokenStats;
    stats6h?: TokenStats;
    stats24h?: TokenStats;

    // Metadata
    updatedAt?: string;
    status?: string;
    score?: number;

    // Allow extra fields from Jupiter
    [key: string]: any;
}

/**
 * Canonical token metadata shape (strict version of JupiterTokenFull)
 */
export interface TokenMetadata {
    id: string;
    name: string;
    symbol: string;
    icon?: string;
    decimals: number;

    dev?: string;
    circSupply?: number;
    totalSupply: number;
    holderCount: number;
    createdAt?: string;

    audit: {
        mintAuthorityDisabled: boolean;
        freezeAuthorityDisabled: boolean;
    };

    firstPool: {
        id: string;
        createdAt: string;
    };
    graduatedAt?: string;
    graduatedPool?: string;
    launchpad?: string;
    dexBanner?: string;

    usdPrice: number;
    priceBlockId: number;
    liquidity: number;
    mcap: number;
    fdv: number;
    fees?: number;

    organicScore: number;
    organicScoreLabel: 'high' | 'medium' | 'low';
    isVerified?: boolean;
    tags?: string[];

    stats1h: TokenStats;
    stats5m: TokenStats;
    stats6h: TokenStats;
    stats24h: TokenStats;

    updatedAt: string;
    status?: string;
    score?: number;
}

/**
 * Token health metrics — full analysis output from token-health.ts
 */
export interface TokenHealthMetrics {
    // Token Identity
    mint: string;
    name: string;
    symbol: string;

    // Price & Liquidity
    price: number;
    liquidity: number;
    marketCap: number;

    // Holder Metrics
    holderCount: number;
    holderChange1h?: number;

    // Trading Activity (1 hour window)
    buyVolume: number;
    sellVolume: number;
    totalVolume: number;

    // Pressure Indicators
    buyPressure: number;
    sellPressure: number;
    netVolume: number;

    // Transaction Counts
    numBuys: number;
    numSells: number;
    totalTransactions: number;

    // Quality Indicators
    netBuyers: number;
    organicBuyers: number;
    organicBuyVolume: number;
    organicScore: number;
    organicScoreLabel: 'high' | 'medium' | 'low';

    // Liquidity Health
    volumeToLiquidityRatio: number;
    liquidityChange: number;

    // Price Movement
    priceChange1h: number;
    priceChange24h: number;

    // Security
    mintAuthorityDisabled: boolean;
    freezeAuthorityDisabled: boolean;

    // Launchpad Info (if applicable)
    launchpad?: string;
    graduatedAt?: string;

    // Overall Health
    healthScore: number;
    verdict: 'healthy' | 'risky' | 'red-flag';
}

/**
 * Token data from Jupiter API v2
 */
export interface JupiterToken {
    id: string;
    name: string;
    symbol: string;
    icon?: string;
    decimals: number;
    holderCount?: number;
    liquidity?: number;
    usdPrice?: number;
    organicScore?: number;
    organicScoreLabel?: 'high' | 'medium' | 'low';
    firstPool?: {
        id: string;
        createdAt: string;
    };
    launchpad?: string;
    graduatedAt?: string;
}

/**
 * Token that has passed eligibility filters for second pump trading
 */
export interface EligibleToken {
    mint: string;
    name?: string;
    symbol?: string;
    holderCount: number;
    createdAt: Date;
    liquidity?: number;
    price?: number;
    organicScore?: number;
    organicScoreLabel?: string;
    launchpad?: string;
}

/**
 * Request body for token discovery/checking endpoint
 */
export interface TokenDiscoveryRequest {
    mintAddress?: string;
    minHolders?: number;
    maxAge?: number; // in hours
}

// ============================================
// Jupiter Category API Types
// ============================================

/**
 * Jupiter category types for token filtering
 */
export type JupiterCategory = 'toporganicscore' | 'toptraded' | 'toptrending';

/**
 * Jupiter time interval options
 */
export type JupiterInterval = '5m' | '1h' | '6h' | '24h';

/**
 * Token Shield warning from Jupiter ultra API
 */
export interface TokenShieldWarning {
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    source: string;
}

/**
 * Token candidate from scanner with analysis data
 * address can be either a string (mint address) or full Jupiter token object
 */
export interface TokenCandidate {
    address: string | JupiterTokenFull;
    symbol?: string;
    name?: string;
    holders: number;
    score: number;
    price?: number;
    liquidity?: number;
    marketCap?: number;
    createdAt?: Date;
    status?: 'watching' | 'consolidating' | 'pumping' | 'exited';
    signals?: string[];
    verdict?: 'healthy' | 'risky' | 'red-flag';
    warnings?: TokenShieldWarning[];
}

/**
 * Response from token discovery endpoint
 */
export interface TokenDiscoveryResponse {
    success: boolean;
    token?: EligibleToken;
    error?: string;
}

// ============================================
// Jupiter Price API Types (v3)
// ============================================

/**
 * Last swapped price info from Jupiter price API
 */
export interface LastSwappedPrice {
    lastJupiterSellAt: number;
    lastJupiterSellPrice: string;
    lastJupiterBuyAt: number;
    lastJupiterBuyPrice: string;
}

/**
 * Quoted price info from Jupiter price API
 */
export interface QuotedPrice {
    buyPrice: string;
    buyAt: number;
    sellPrice: string;
    sellAt: number;
}

/**
 * Depth info with price impact ratios at different levels
 */
export interface DepthInfo {
    depth: {
        '10': number;
        '100': number;
        '1000': number;
    };
}

/**
 * Extra info containing confidence level and pricing details
 */
export interface JupiterTokenPriceExtraInfo {
    lastSwappedPrice?: LastSwappedPrice;
    quotedPrice?: QuotedPrice;
    confidenceLevel?: 'high' | 'medium' | 'low';
    depth?: {
        buyPriceImpactRatio: DepthInfo;
        sellPriceImpactRatio: DepthInfo;
    };
}

/**
 * Individual token price data from Jupiter price API v3
 */
export interface JupiterTokenPriceData {
    id: string;
    type: string;
    price: string;
    extraInfo?: JupiterTokenPriceExtraInfo;
}

/**
 * Full response from Jupiter price API v3
 */
export interface JupiterTokenPrice {
    data: Record<string, JupiterTokenPriceData>;
    timeTaken: number;
}
