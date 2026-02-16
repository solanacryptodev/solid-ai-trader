/**
 * HeliusJupiterExecutor.ts
 * Blockchain interaction service combining Helius RPC with Jupiter DEX
 * Uses Solana Kit (@solana/kit) for blockchain operations
 * Uses Jupiter API for token discovery (No RPC required)
 */

import { createSolanaRpc } from "@solana/kit";

// Types for blockchain interaction
export interface SwapParams {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps: number;
}

export interface SwapQuote {
    inAmount: number;
    outAmount: number;
    priceImpactPct: number;
    route: any[];
}

export interface ExecutionResult {
    success: boolean;
    txId?: string;
    error?: string;
}

// Token discovery types
export interface TokenInfo {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    icon: string;
    marketCap?: number;
    price?: number;
    change24h?: number;
    // Additional metadata fields from Jupiter API
    tags?: string[];
    liquidity?: number;
    volume24h?: number;
    // Token launchpad
    launchpad?: string;
    createdAt?: string;
    graduatedAt?: string;
}

export class HeliusJupiterExecutor {
    private heliusRpcUrl: string;
    private jupiterQuoteUrl = "https://quote-api.jup.ag/v6";
    // Using Jupiter's v2 API - works without RPC
    private jupiterTokenUrl = "https://lite-api.jup.ag/tokens/v2/recent";
    private rpc: ReturnType<typeof createSolanaRpc>;

    constructor(heliusRpcUrl: string) {
        this.heliusRpcUrl = heliusRpcUrl;
        this.rpc = createSolanaRpc(heliusRpcUrl);
    }

    /**
     * Discover tokens from launchpads using Jupiter's API
     * NOTE: This uses Jupiter's API directly - NO RPC required!
     * @param limit Number of tokens to return (default: 100)
     */
    async discoverTokens(
        limit: number = 100
    ): Promise<TokenInfo[]> {
        try {
            // Use URLSearchParams like getQuote example
            const params = new URLSearchParams({
                query: "",
                limit: limit.toString()
            });

            const response = await fetch(`${this.jupiterTokenUrl}?${params}`);
            if (!response.ok) {
                throw new Error(`Jupiter token API failed: ${response.statusText}`);
            }

            const data = await response.json();

            // Log full JSON metadata to console for debugging
            console.log("Jupiter Token API Response:", JSON.stringify(data, null, 2));

            // The v2 API returns { data: [...] } structure
            const tokens = data || [];

            // Filter tokens by launchpad (pump.fun, bonk.fun, letsbonk.fun)
            const filteredTokens = tokens.filter((token: any) => {
                const launchpad = token.launchpad || '';

                const isPumpFun = launchpad === 'pump.fun';
                const isBonkFun = launchpad === 'bonk.fun' || launchpad === 'letsbonk.fun';

                return isPumpFun || isBonkFun;
            });

            console.log("Filtered Tokens:", filteredTokens);
            console.log(`Filtered from ${tokens.length} to ${filteredTokens.length} tokens`);

            // Map tokens to TokenInfo format
            const topTokens: TokenInfo[] = filteredTokens.slice(0, limit).map((token: any) => ({
                address: token.id,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
                icon: token.icon,
                marketCap: token.mcap,
                price: token.usdPrice,
                change24h: token.priceChange24h,
                tags: token.tags,
                liquidity: token.liquidity,
                volume24h: token.volume24h,
                launchpad: token.launchpad,
                createdAt: token.createdAt,
                graduatedAt: token.graduatedAt
            }));

            return topTokens;
        } catch (error) {
            console.error("Failed to discover tokens:", error);
            return [];
        }
    }

    /**
     * Get a quote for a token swap from Jupiter
     */
    async getQuote(params: SwapParams): Promise<SwapQuote | null> {
        try {
            const url = new URL(`${this.jupiterQuoteUrl}/quote`);
            url.searchParams.set("inputMint", params.inputMint);
            url.searchParams.set("outputMint", params.outputMint);
            url.searchParams.set("amount", params.amount.toString());
            url.searchParams.set("slippageBps", params.slippageBps.toString());

            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`Jupiter quote failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error("Failed to get quote:", error);
            return null;
        }
    }

    /**
     * Execute a swap transaction using Solana Kit
     */
    async executeSwap(quote: SwapQuote): Promise<ExecutionResult> {
        // Implementation would go here using Solana Kit
        return { success: false, error: "Not implemented" };
    }

    /**
     * Get recently graduated tokens - simply returns 5 tokens from the recent API
     */
    async getRecentlyGraduatedTokens(): Promise<TokenInfo[]> {
        try {
            const params = new URLSearchParams({
                limit: "5"
            });

            const response = await fetch(`${this.jupiterTokenUrl}?${params}`);
            if (!response.ok) {
                throw new Error(`Jupiter token API failed: ${response.statusText}`);
            }

            const tokens = await response.json();

            // Map to TokenInfo format
            const topTokens: TokenInfo[] = tokens.slice(0, 5).map((token: any) => ({
                address: token.address,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
                icon: token.icon,
                marketCap: token.marketCap,
                price: token.usdPrice,
                change24h: token.priceChange24h,
                tags: token.tags,
                liquidity: token.liquidity,
                volume24h: token.volume24h,
                launchpad: token.launchpad,
                createdAt: token.createdAt,
                graduatedAt: token.graduatedAt
            }));

            return topTokens;
        } catch (error) {
            console.error("Failed to get recently graduated tokens:", error);
            return [];
        }
    }

    /**
     * Get token balance for an address using Helius RPC
     */
    async getTokenBalance(walletAddress: string, tokenMint: string): Promise<number> {
        // Implementation would go here using this.rpc
        return 0;
    }

    /**
     * Submit a transaction to the network using Solana Kit
     */
    async submitTransaction(transaction: any): Promise<string | null> {
        // Implementation would go here
        return null;
    }
}

export default HeliusJupiterExecutor;
