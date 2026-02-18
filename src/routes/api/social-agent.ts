/**
 * Social Agent API Route
 * Server-side endpoint for social sentiment analysis
 * This runs on the server - never bundled to client
 */

import type { APIEvent } from "@solidjs/start/server";
import type { TokenInput, SocialAgentResult } from "~/agent/types";
import { analyzeToken } from "~/server/agents/SocialAgent";

/**
 * POST handler for social agent analysis
 */
export async function POST({ request }: APIEvent) {
    try {
        const body = await request.json();
        const { token } = body as {
            token: TokenInput;
        };

        if (!token || (!token.symbol && !token.name)) {
            return new Response(
                JSON.stringify({ error: "Invalid token input. Required: symbol or name" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Run the server-side analysis
        const result: SocialAgentResult = await analyzeToken(token);

        return new Response(
            JSON.stringify(result),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Social Agent API error:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

/**
 * GET handler - return API status
 */
export async function GET({ request }: APIEvent) {
    const hasTwitterToken = !!process.env.TWITTER_BEARER_TOKEN;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    return new Response(
        JSON.stringify({
            status: "ok",
            services: {
                twitter: hasTwitterToken ? "configured" : "missing (using mock data)",
                openai: hasOpenAIKey ? "configured (LLM analysis)" : "missing (keyword fallback)",
            },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
}
