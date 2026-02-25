/**
 * DeepAgent SubAgents
 * Contains subagent definitions and the TradingAgent orchestrator
 */

import { SubAgent } from "deepagents";
import { ChatOpenAI } from "@langchain/openai";
import { socialAnalysisTool, tradingAnalysisTool } from "./tools";
import { ORCHESTRATOR_SYSTEM_PROMPT, SOCIAL_AGENT_PROMPT, TRADING_AGENT_PROMPT } from "./prompts";

/**
 * Get API key from environment (server-side)
 * Checks both VITE_ prefixed (client) and server-only variables
 */
function getApiKey(): string {
    return import.meta.env.OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY || "";
}

/**
 * Main model for the orchestrator
 */
export function createModel(): ChatOpenAI {
    const apiKey = getApiKey();
    return new ChatOpenAI({
        modelName: "qwen/qwen3.5-397b-a17b",
        temperature: 0.3,
        maxTokens: 500,
        apiKey: apiKey,
        configuration: {
            baseURL: "https://openrouter.ai/api/v1",
        },
    });
}

/**
 * Social model for the social subagent
 */
export function createSocialModel(): ChatOpenAI {
    const apiKey = getApiKey();
    return new ChatOpenAI({
        modelName: "qwen/qwen3.5-397b-a17b",
        temperature: 0.3,
        maxTokens: 500,
        apiKey: apiKey,
        configuration: {
            baseURL: "https://openrouter.ai/api/v1",
        },
    });
}

/**
 * Create the Social SubAgent
 */
export function createSocialSubAgent(): SubAgent {
    const socialModel = createSocialModel();

    return {
        name: "Social Agent",
        model: socialModel,
        systemPrompt: SOCIAL_AGENT_PROMPT,
        description: "Social agent for analyzing social media sentiment for tokens",
        tools: [socialAnalysisTool],
    };
}

/**
 * Create the Trading SubAgent
 */
export function createTradingSubAgent(): SubAgent {
    const tradingModel = createModel();

    return {
        name: "Trading Agent",
        model: tradingModel,
        systemPrompt: TRADING_AGENT_PROMPT,
        description: "Trading agent for getting into and out of trades according to Chronos alerts and Solana blockchain data.",
        tools: [tradingAnalysisTool],
    };
}

/**
 * TradingAgent Class
 * Main orchestrator for the AI trading system
 * Creates and manages the DeepAgent with all subagents
 */
export class OrchestratorAgent {
    private agent: any = null;

    /**
     * Initialize the DeepAgent instance (server-side)
     */
    async initialize(): Promise<any> {
        if (this.agent) {
            return this.agent;
        }

        const apiKey = getApiKey();

        if (!apiKey) {
            throw new Error("OpenAI API key not available on server");
        }

        // Dynamic imports - only loads on server
        const { createDeepAgent } = await import("deepagents");

        const model = createModel();
        const socialSubAgent = createSocialSubAgent();
        const tradingSubAgent = createTradingSubAgent();

        // Create the Orchestrator Agent
        this.agent = createDeepAgent({
            model,
            subagents: [socialSubAgent, tradingSubAgent],
            systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
            name: "Trading Orchestrator",
        });

        return this.agent;
    }

    /**
     * Get the initialized agent
     */
    async getAgent(): Promise<any> {
        if (!this.agent) {
            return this.initialize();
        }
        return this.agent;
    }
}

// Export a singleton instance for convenience
export const orchestratorAgent = new OrchestratorAgent();

export default OrchestratorAgent;