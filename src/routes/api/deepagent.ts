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
import { CompiledSubAgent, SubAgent } from "deepagents";
import { createAgent } from "langchain";
import { z } from "zod";
import { analyzeToken } from "~/server/agents/SocialAgent";
import { SystemMessage, HumanMessage } from "langchain";

/**
 * Get API key from environment (server-side)
 * Checks both VITE_ prefixed (client) and server-only variables
 */
function getApiKey(): string {
    // First try server-only env var (优先检查服务器专用环境变量)
    return import.meta.env.OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY || "";
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

    const model = new ChatOpenAI(
        {
            modelName: "qwen/qwen3.5-397b-a17b",
            temperature: 0.3,
            maxTokens: 500,
            apiKey: apiKey,
            configuration: {
                baseURL: "https://openrouter.ai/api/v1",
            },
        });

    // Zod schema for token input validation
    const TokenInputSchema = z.object({
        address: z.string().optional(),
        symbol: z.string().optional(),
        name: z.string().optional(),
    });

    // Create the Social Agent tool that wraps analyzeToken from SocialAgent.ts
    const socialAnalysisTool = new DynamicTool({
        name: "analyze_social",
        description: "Analyze social media sentiment for a cryptocurrency token. Input: JSON object with address, symbol, and name of the token.",
        func: async (input: string): Promise<string> => {
            try {
                // console.log("Social analysis tool input:", input);
                // Parse and validate input using Zod
                const parsedInput = JSON.parse(input);
                const tokenData = TokenInputSchema.parse(parsedInput);

                // Create TokenInput object
                const token: TokenInput = {
                    address: tokenData.address || "",
                    symbol: tokenData.symbol || "",
                    name: tokenData.name || "",
                };

                // Call the actual SocialAgent analyzeToken function
                // console.log("Social analysis tool input:", token);
                const result: SocialAgentResult = await analyzeToken(token);
                // console.log("Social analysis tool result:", result);

                return JSON.stringify(result);
            } catch (error) {
                console.error("Social analysis tool error:", error);
                return JSON.stringify({
                    agentName: "SocialAgent",
                    success: false,
                    timestamp: Date.now(),
                    error: error instanceof Error ? error.message : "Analysis failed",
                    tweets: [],
                    sentiment: {
                        score: 0,
                        label: "neutral",
                        confidence: 0,
                        keyThemes: [],
                    },
                    mentions: 0,
                    trending: false,
                });
            }
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

    const socialModel = new ChatOpenAI(
        {
            modelName: "qwen/qwen3.5-397b-a17b",
            temperature: 0.3,
            maxTokens: 500,
            apiKey: apiKey,
            configuration: {
                baseURL: "https://openrouter.ai/api/v1",
            },
        });


    const socialSubAgent: SubAgent = ({
        name: "Social Agent",
        model: socialModel,
        systemPrompt: SOCIAL_AGENT_PROMPT,
        description: "Social agent for analyzing social media sentiment for tokens",
        tools: [socialAnalysisTool],
    });

    // Create the DeepAgent
    deepAgentInstance = createDeepAgent({
        model,
        subagents: [socialSubAgent],
        systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
        name: "Trading Orchestrator",
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
        //console.log("DeepAgent initialized", agent);

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
        // console.log("DeepAgent response", response);

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

                console.log('Parsed social result:', socialResult);
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
