/**
 * DeepAgent API Route
 * Server-side endpoint for DeepAgent orchestration
 * This runs on the server to avoid bundling heavy deepagents package into client
 */

import type { APIEvent } from "@solidjs/start/server";
import type { TokenInput } from "~/agent/types";

/**
 * Get API key from environment (server-side)
 */
function getApiKey(): string {
    return process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "";
}

/**
 * System prompt for the Orchestrator Agent
 */
const ORCHESTRATOR_SYSTEM_PROMPT = `You are the Orchestrator Agent for a cryptocurrency trading system.
Your role is to analyze tokens and coordinate analysis across multiple specialized sub-agents.

Available sub-agents:
- social: Analyzes social media sentiment (Twitter/X)
- chart: Performs technical analysis on price charts
- model: Uses ML models (Chronos) for price predictions
- security: Performs security checks (rug detection)
- execution: Determines trade execution recommendations

For each token analysis:
1. Gather data from relevant sub-agents
2. Synthesize the results
3. Provide a final trading recommendation (BUY, SELL, HOLD)
4. Include confidence scores and reasoning

Always prioritize risk management and security checks.`;

const SOCIAL_AGENT_PROMPT = `You are the Social Agent. Analyze social media sentiment for a cryptocurrency token.
Search Twitter for mentions and analyze the sentiment. Provide:
- Sentiment score (-1 to 1)
- Sentiment label (bullish/bearish/neutral)
- Confidence (0-1)
- Key themes discussed
- Whether the token is trending`;

/**
 * Lazy-initialized DeepAgent instance (server-side only)
 * Uses dynamic imports to prevent bundling to client
 */
let deepAgentInstance: any = null;

/**
 * Initialize the DeepAgent instance (server-side)
 */
async function getDeepAgent(): Promise<any> {
    if (deepAgentInstance) {
        return deepAgentInstance;
    }

    const apiKey = getApiKey();

    if (!apiKey) {
        throw new Error("OpenAI API key not available on server");
    }

    // Dynamic imports - only loads on server
    const { createDeepAgent } = await import("deepagents");
    const { ChatOpenAI } = await import("@langchain/openai");
    const { DynamicTool } = await import("langchain");

    const model = new ChatOpenAI({
        modelName: "gpt-4o",
        temperature: 0.3,
        openAIApiKey: apiKey,
    });

    // Create placeholder tools
    const socialAnalysisTool = new DynamicTool({
        name: "analyze_social",
        description: "Analyze social media sentiment for a cryptocurrency token.",
        func: async (): Promise<string> => {
            return JSON.stringify({
                agentName: "SocialAgent",
                success: true,
                timestamp: Date.now(),
                sentiment: {
                    score: 0.5,
                    label: "bullish",
                    confidence: 0.7,
                    keyThemes: ["momentum", "community"],
                },
            });
        },
    });

    const chartAnalysisTool = new DynamicTool({
        name: "analyze_chart",
        description: "Perform technical analysis on a cryptocurrency token.",
        func: async (): Promise<string> => {
            return JSON.stringify({
                agentName: "ChartAgent",
                success: true,
                timestamp: Date.now(),
                signals: [],
                indicators: [],
                pattern: null,
            });
        },
    });

    const modelAnalysisTool = new DynamicTool({
        name: "analyze_model",
        description: "Get ML model predictions for a cryptocurrency token.",
        func: async (): Promise<string> => {
            return JSON.stringify({
                agentName: "ModelAgent",
                success: true,
                timestamp: Date.now(),
                predictions: null,
                confidence: 0,
            });
        },
    });

    const securityAnalysisTool = new DynamicTool({
        name: "analyze_security",
        description: "Perform security checks on a cryptocurrency token.",
        func: async (): Promise<string> => {
            return JSON.stringify({
                agentName: "SecurityAgent",
                success: true,
                timestamp: Date.now(),
                rugCheck: {
                    isHoneypot: false,
                    mintAuthority: null,
                    riskLevel: "low",
                    top10HolderPercent: 0,
                },
                riskScore: 0,
            });
        },
    });

    const executionAnalysisTool = new DynamicTool({
        name: "analyze_execution",
        description: "Generate trade execution recommendation based on all agent results.",
        func: async (): Promise<string> => {
            return JSON.stringify({
                agentName: "ExecutionAgent",
                success: true,
                timestamp: Date.now(),
                recommendation: "HOLD",
                reasoning: "Analysis complete",
                confidence: 0.5,
            });
        },
    });

    const orchestratorTools = [
        socialAnalysisTool,
        chartAnalysisTool,
        modelAnalysisTool,
        securityAnalysisTool,
        executionAnalysisTool,
    ];

    // Define sub-agents
    const subagents = [
        {
            name: "social",
            description: "Analyzes social media sentiment for tokens",
            systemPrompt: SOCIAL_AGENT_PROMPT,
            tools: [socialAnalysisTool],
        },
    ];

    // Create the DeepAgent
    deepAgentInstance = createDeepAgent({
        model,
        tools: orchestratorTools,
        subagents,
        systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
        name: "TradingOrchestrator",
    });

    return deepAgentInstance;
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

        const agent = await getDeepAgent();

        const prompt = `Analyze the token ${token.symbol} (${token.name}) at address ${token.address || 'unknown'}.
Run analysis using these agents: ${agents.join(", ")}.
Provide a final trading recommendation with confidence score.`;

        const response = await agent.invoke({
            messages: [{ role: "user", content: prompt }],
        });

        return new Response(
            JSON.stringify({
                success: true,
                response: response,
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
