// CRITICAL: Set process.env before any LangChain imports
// LangChain middleware checks process.env.OPENAI_API_KEY directly
const openAiKey = import.meta.env.OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY;
if (openAiKey && !process.env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = openAiKey;
}

/**
 * DeepAgent API Route
 * Server-side endpoint for DeepAgent orchestration
 * This runs on the server to avoid bundling heavy deepagents package into client
 */

import type { APIEvent } from "@solidjs/start/server";
import type { TokenInput, SocialAgentResult } from "~/agent/types";
import { SystemMessage, HumanMessage } from "langchain";
import { orchestratorAgent } from "~/agent/agents";

/**
 * Get API key from environment (server-side)
 * Checks both VITE_ prefixed (client) and server-only variables
 */
function getApiKey(): string {
    // First try server-only env var (优先检查服务器专用环境变量)
    return import.meta.env.OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY || "";
}

/**
 * POST handler for DeepAgent analysis
 */
export async function POST({ request }: APIEvent) {
    try {
        const body = await request.json();
        const { token, agents = ["social"] } = body as {
            token: TokenInput;
            agents?: string[];
        };

        if (!token || !token.symbol) {
            return new Response(
                JSON.stringify({ error: "Invalid token input" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const apiKey = getApiKey();

        // If no API key, return fallback response
        if (!apiKey) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "OpenAI API key not configured",
                    fallback: true,
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        const agent = await orchestratorAgent.getAgent();

        const prompt = `Analyze the token ${token.symbol} (${token.name}) at address ${token.address || 'unknown'}.
            Run analysis using these agents: ${agents.join(", ")}.
            When you get the results from the SocialAgent, provide a JSON response with the following structure:
            {
                "score": number between -1 (very bearish) and 1 (very bullish),
                "label": "bullish" | "bearish" | "neutral",
                "confidence": number between 0 and 1,
                "keyThemes": array of strings (main topics discussed, max 5)
            }
            Respond only with valid JSON.`;

        // Use object format to properly initialize middleware state (required for todoListMiddleware)
        const response = await agent.invoke({
            messages: [
                new SystemMessage(prompt),
                new HumanMessage(`Provide me with the social agent analysis for the ${token.name} token.`),
            ],
            todos: [], // Initialize empty todos for the todoListMiddleware
        });

        // Extract the SocialAgent result from the DeepAgent response
        // The tool returns the full SocialAgentResult structure
        let socialResult: SocialAgentResult | null = null;

        try {
            // Get the messages array from the response
            const messages = response.messages || [];

            // Find the last AI message (which contains the final response)
            const lastAIMessage = [...messages].reverse().find(
                (msg: any) => msg._type === 'ai' || msg.type === 'ai' || msg.constructor?.name === 'AIMessage'
            );

            if (lastAIMessage && lastAIMessage.content) {
                let content = lastAIMessage.content;

                // Handle markdown code blocks (```json ... ```)
                const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
                if (jsonMatch && jsonMatch[1]) {
                    content = jsonMatch[1];
                }

                // Parse the JSON content
                const parsedData = JSON.parse(content.trim());

                // Transform to SocialAgentResult format
                socialResult = {
                    agentName: "SocialAgent",
                    success: true,
                    timestamp: Date.now(),
                    tweets: [],
                    sentiment: {
                        score: parsedData.score ?? 0,
                        label: parsedData.label ?? "neutral",
                        confidence: parsedData.confidence ?? 0,
                        keyThemes: parsedData.keyThemes ?? [],
                    },
                    mentions: 0,
                    trending: false,
                };
            }
        } catch (e) {
            console.error('Failed to extract social result:', e);
        }

        return new Response(
            JSON.stringify({
                success: true,
                results: {
                    social: socialResult,
                },
                token,
                agents,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("DeepAgent API error:", error);
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
    const apiKey = getApiKey();
    return new Response(
        JSON.stringify({
            status: "ok",
            deepAgentAvailable: !!apiKey,
            message: apiKey ? "DeepAgent is configured" : "OpenAI API key not found",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
}