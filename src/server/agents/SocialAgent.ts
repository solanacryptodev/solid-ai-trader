// CRITICAL: Set process.env before any LangChain imports
// LangChain middleware checks process.env.OPENAI_API_KEY directly
const openAiKey = import.meta.env.OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY;
if (openAiKey && !process.env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = openAiKey;
}

/**
 * Server-side SocialAgent
 * This file runs ONLY on the server - never bundled to client
 * Uses server-side environment variables for API keys
 */

import { SystemMessage, HumanMessage } from "langchain";
import type { TokenInput, SocialAgentResult, TweetData, SentimentAnalysis } from "~/agent/types";

/**
 * Get API keys from server-side environment
 */
function getTwitterBearerToken(): string {
    return import.meta.env.VITE_TWITTER_BEARER_TOKEN || "";
}

function getOpenAIApiKey(): string {
    // First try server-only env var, then fall back to VITE_ prefixed (client)
    return import.meta.env.OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY || "";
}

/**
 * Twitter search - server-side only
 */
async function searchTwitter(query: string, apiKey?: string): Promise<TweetData[]> {
    const bearerToken = apiKey || getTwitterBearerToken();

    if (!bearerToken) {
        console.warn("No Twitter bearer token, using mock data");
        return getMockTweets(query);
    }

    try {
        const response = await fetch(
            `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=30&tweet.fields=created_at,public_metrics,author_id`,
            {
                headers: {
                    "Authorization": `Bearer ${bearerToken}`,
                    "Content-Type": "application/json",
                },
            }
        );

        if (!response.ok) {
            console.warn("Twitter API error:", response.status);
            return getMockTweets(query);
        }

        const data = await response.json();
        // console.log('twitter data', data.data);

        if (!data.data) {
            return getMockTweets(query);
        }

        return data.data.map((tweet: any) => ({
            id: tweet.id,
            text: tweet.text,
            author: tweet.author_id || "unknown",
            createdAt: tweet.created_at,
            likes: tweet.public_metrics?.like_count || 0,
            retweets: tweet.public_metrics?.retweet_count || 0,
            replies: tweet.public_metrics?.reply_count || 0,
        }));
    } catch (error) {
        console.warn("Twitter search failed:", error);
        return getMockTweets(query);
    }
}

/**
 * Generate mock tweets for testing/fallback
 */
function getMockTweets(query: string): TweetData[] {
    return [
        {
            id: "1",
            text: `Just bought some $${query}! Looking like a gem 🚀`,
            author: "crypto_trader",
            createdAt: new Date().toISOString(),
            likes: 150,
            retweets: 25,
            replies: 10,
        },
        {
            id: "2",
            text: `$${query} showing strong momentum today, this could be the next big thing`,
            author: "defi_analyst",
            createdAt: new Date().toISOString(),
            likes: 89,
            retweets: 12,
            replies: 5,
        },
        {
            id: "3",
            text: `Watching $${query} closely. Could be a good entry point.`,
            author: "solana_degen",
            createdAt: new Date().toISOString(),
            likes: 45,
            retweets: 8,
            replies: 3,
        },
        {
            id: "4",
            text: `$${query} community is growing fast!`,
            author: "crypto_enthusiast",
            createdAt: new Date().toISOString(),
            likes: 67,
            retweets: 15,
            replies: 7,
        },
    ];
}

/**
 * Extract JSON from markdown code blocks (e.g., ```json {...} ```)
 */
function extractJsonFromMarkdown(content: string): string {
    // Remove markdown code block fences (```json or ```)
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        return jsonMatch[1].trim();
    }
    // If no code block, try to find JSON object directly
    const jsonObjMatch = content.match(/\{[\s\S]*\}/);
    if (jsonObjMatch) {
        return jsonObjMatch[0];
    }
    // Return original content if no pattern matches
    return content.trim();
}

/**
 * Keyword-based sentiment analysis (works without LLM)
 */
function keywordBasedSentiment(tweets: TweetData[]): SentimentAnalysis {
    const bullishKeywords = ["moon", "pump", "bull", "buy", "long", "gain", "profit", "up", "green", "hodl", "gem", "alerts", "growth"];
    const bearishKeywords = ["dump", "bear", "sell", "short", "loss", "down", "red", "scam", "rug", "danger", "warning", "avoid", "crash"];

    let bullishCount = 0;
    let bearishCount = 0;
    const themes: Set<string> = new Set();

    for (const tweet of tweets) {
        const text = tweet.text.toLowerCase();

        for (const keyword of bullishKeywords) {
            if (text.includes(keyword)) {
                bullishCount++;
                themes.add(keyword);
            }
        }

        for (const keyword of bearishKeywords) {
            if (text.includes(keyword)) {
                bearishCount++;
                themes.add(keyword);
            }
        }
    }

    const total = bullishCount + bearishCount;
    const score = total > 0 ? (bullishCount - bearishCount) / total : 0;

    let label: "bullish" | "bearish" | "neutral";
    if (score > 0.2) {
        label = "bullish";
    } else if (score < -0.2) {
        label = "bearish";
    } else {
        label = "neutral";
    }

    const confidence = Math.min(Math.abs(score) + 0.3, 1);

    return {
        score,
        label,
        confidence,
        keyThemes: Array.from(themes).slice(0, 5),
    };
}

/**
 * LLM-based sentiment analysis (if OpenAI key available)
 * Uses dynamic import to ensure LangChain stays server-side
 */
async function analyzeWithLLM(tweets: TweetData[], token: TokenInput): Promise<SentimentAnalysis> {
    const apiKey = getOpenAIApiKey();

    if (!apiKey) {
        return keywordBasedSentiment(tweets);
    }

    try {
        // Dynamic import - only loads on server
        const { ChatOpenAI } = await import("@langchain/openai");

        const model = new ChatOpenAI(
            {
                modelName: "deepseek/deepseek-v3.2",
                temperature: 0.3,
                maxTokens: 500,
                apiKey: apiKey,
                configuration: {
                    baseURL: "https://openrouter.ai/api/v1",
                },
            });

        const tweetTexts = tweets.map((t) => t.text).join("\n- ");

        const prompt = `Analyze the sentiment of these tweets about a cryptocurrency.
Provide a JSON response with the following structure:
{
    "score": number between -1 (very bearish) and 1 (very bullish),
    "label": "bullish" | "bearish" | "neutral",
    "confidence": number between 0 and 1,
    "keyThemes": array of strings (main topics discussed, max 5)
}

Tweets to analyze:
- ${tweetTexts}

Respond only with valid JSON.`;

        const response = await model.invoke([
            new SystemMessage(prompt),
            new HumanMessage(`Provide me with the sentiment analysis of the tweets for the ${token.name} token.`),
        ]);
        const content = response.content as string;
        // console.log('content', content);

        const parsed = JSON.parse(extractJsonFromMarkdown(content));

        return {
            score: parsed.score,
            label: parsed.label,
            confidence: parsed.confidence,
            keyThemes: parsed.keyThemes || [],
        };
    } catch (error) {
        console.warn("LLM sentiment analysis failed:", error);
        return keywordBasedSentiment(tweets);
    }
}

/**
 * Server-side SocialAgent analysis function
 * Call this from API routes only
 */
export async function analyzeToken(token: TokenInput): Promise<SocialAgentResult> {
    try {
        const searchQuery = token.symbol ? `$${token.symbol} ${token.name}` : token.name;
        console.log('searchQuery', searchQuery);

        // Search Twitter
        const tweets = await searchTwitter(searchQuery);

        // Use LLM if available, otherwise keyword-based
        let sentiment: SentimentAnalysis;
        const hasOpenAI = !!getOpenAIApiKey();

        if (hasOpenAI) {
            sentiment = await analyzeWithLLM(tweets, token);
        } else {
            sentiment = keywordBasedSentiment(tweets);
        }

        const mentions = tweets.length;
        const trending = mentions > 5;

        return {
            agentName: "SocialAgent",
            success: true,
            timestamp: Date.now(),
            tweets: tweets.slice(0, 10),
            sentiment,
            mentions,
            trending,
        };
    } catch (error) {
        console.error("SocialAgent analysis error:", error);
        return {
            agentName: "SocialAgent",
            success: false,
            timestamp: Date.now(),
            error: error instanceof Error ? error.message : "Unknown error",
            tweets: [],
            sentiment: {
                score: 0,
                label: "neutral",
                confidence: 0,
                keyThemes: [],
            },
            mentions: 0,
            trending: false,
        };
    }
}

export default analyzeToken;
