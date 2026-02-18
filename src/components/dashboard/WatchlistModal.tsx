import { Show, createSignal, For } from "solid-js";
import type { SocialAgentResult } from "~/agent/types";

// Token shield warning interface
interface TokenShieldWarning {
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    source: string;
}

// Watchlist item interface
interface WatchlistItem {
    id: string;
    name: string;
    token: string;
    icon: string;
    price: string;
    change: string;
    changeColor: string;
    score?: number;
    holders?: number;
    address: string;
    warnings?: TokenShieldWarning[];
}

interface WatchlistModalProps {
    token: WatchlistItem;
    onClose: () => void;
    onCopy: () => void;
    copied: boolean;
    shouldShowFallback: (id: string, icon: string) => boolean;
    handleImageError: (id: string) => void;
    onAnalyze?: (token: WatchlistItem) => void;
}

function formatHolders(holders?: number): string {
    if (!holders) return "-";
    return holders.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function getScoreColor(score?: number): string {
    if (!score) return "text-slate-400";
    if (score >= 7) return "text-green-400";
    if (score >= 5) return "text-yellow-400";
    return "text-slate-400";
}

export default function WatchlistModal(props: WatchlistModalProps) {
    // Analysis state
    const [analyzing, setAnalyzing] = createSignal(false);
    const [analysisResult, setAnalysisResult] = createSignal<SocialAgentResult | null>(null);
    const [analysisError, setAnalysisError] = createSignal<string | null>(null);

    async function handleAnalyze() {
        if (!props.token) return;

        setAnalyzing(true);
        setAnalysisError(null);
        setAnalysisResult(null);

        try {
            // Call the server-side API endpoint
            const response = await fetch("/api/social-agent", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    token: {
                        address: props.token.address,
                        symbol: props.token.token,
                        name: props.token.name,
                    },
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Analysis failed");
            }

            setAnalysisResult(data);

            // Also notify parent component if callback provided
            if (props.onAnalyze) {
                props.onAnalyze(props.token);
            }
        } catch (error) {
            setAnalysisError(error instanceof Error ? error.message : "Analysis failed");
        } finally {
            setAnalyzing(false);
        }
    }

    function getSentimentColor(label: string): string {
        switch (label) {
            case "bullish": return "text-green-400";
            case "bearish": return "text-red-400";
            default: return "text-slate-400";
        }
    }

    return (
        <div
            class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) props.onClose();
            }}
        >
            <div class="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <Show when={!props.shouldShowFallback(props.token.id, props.token.icon)} fallback={
                            <div class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                                {props.token.icon}
                            </div>
                        }>
                            <img
                                src={props.token.icon}
                                alt={`${props.token.token} icon`}
                                class="w-12 h-12 rounded-full object-cover"
                                onError={() => props.handleImageError(props.token.id)}
                            />
                        </Show>
                        <div>
                            <div class="text-white font-semibold text-lg">{props.token.token}</div>
                            <Show when={props.token.name && props.token.name !== props.token.token}>
                                <div class="text-slate-400 text-sm">{props.token.name}</div>
                            </Show>
                        </div>
                    </div>
                    <button
                        class="text-slate-400 hover:text-white transition-colors"
                        onClick={props.onClose}
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div class="space-y-4">
                    {/* Token Address */}
                    <div>
                        <div class="text-slate-400 text-xs mb-1">Token Address</div>
                        <div class="bg-slate-900 rounded-lg p-3 flex items-center gap-2">
                            <code class="text-white text-sm flex-1 break-all font-mono">
                                {props.token.address}
                            </code>
                            <button
                                class={`px-3 py-1.5 text-sm rounded-lg transition-colors flex-shrink-0 ${props.copied
                                    ? "bg-green-600 text-white"
                                    : "bg-blue-600 hover:bg-blue-500 text-white"
                                    }`}
                                onClick={props.onCopy}
                            >
                                {props.copied ? "Copied!" : "Copy"}
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div class="grid grid-cols-2 gap-3">
                        <div class="bg-slate-900 rounded-lg p-3">
                            <div class="text-slate-400 text-xs">Holders</div>
                            <div class="text-white font-semibold">{formatHolders(props.token.holders ?? undefined)}</div>
                        </div>
                        <div class="bg-slate-900 rounded-lg p-3">
                            <div class="text-slate-400 text-xs">Score</div>
                            <div class={`font-semibold ${getScoreColor(props.token.score)}`}>
                                {props.token.score ?? '-'}
                            </div>
                        </div>
                        <div class="bg-slate-900 rounded-lg p-3">
                            <div class="text-slate-400 text-xs">Price</div>
                            <div class="text-white font-semibold">{props.token.price ?? '-'}</div>
                        </div>
                        <div class="bg-slate-900 rounded-lg p-3">
                            <div class="text-slate-400 text-xs">Change</div>
                            <div class={`text-white font-semibold`}>{props.token.change ?? '-'}</div>
                        </div>
                    </div>

                    {/* Token Shield Warnings */}
                    <Show when={props.token.warnings && props.token.warnings.length > 0}>
                        <div class="bg-red-900/20 border border-red-600/50 rounded-lg p-3 space-y-2">
                            <div class="flex items-center gap-2 text-red-400">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span class="text-xs font-semibold uppercase tracking-wide">Security Warnings</span>
                            </div>
                            <For each={props.token.warnings}>
                                {(warning) => (
                                    <div class="text-red-300 text-sm">
                                        <span class="font-semibold">[{warning.type}]</span> {warning.message}
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>

                    {/* Analyze with AI Button */}
                    <button
                        class={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${analyzing()
                            ? "bg-slate-600 text-slate-400 cursor-wait"
                            : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white"
                            }`}
                        onClick={handleAnalyze}
                        disabled={analyzing()}
                    >
                        <Show when={analyzing()} fallback={
                            <>
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Analyze with AI
                            </>
                        }>
                            <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Analyzing...
                        </Show>
                    </button>

                    {/* Analysis Error */}
                    <Show when={analysisError()}>
                        <div class="bg-red-900/30 border border-red-700/50 rounded-lg p-3">
                            <div class="text-red-400 text-sm">{analysisError()}</div>
                        </div>
                    </Show>

                    {/* Analysis Results */}
                    <Show when={analysisResult()}>
                        {(result) => (
                            <div class="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 space-y-3">
                                <div class="flex items-center justify-between">
                                    <div class="text-slate-400 text-xs uppercase tracking-wide">Social Analysis</div>
                                    <Show when={result().trending}>
                                        <span class="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full">
                                            Trending
                                        </span>
                                    </Show>
                                </div>

                                {/* Sentiment */}
                                <div class="flex items-center justify-between">
                                    <div class="text-slate-400 text-sm">Sentiment</div>
                                    <div class={`font-semibold capitalize ${getSentimentColor(result().sentiment.label)}`}>
                                        {result().sentiment.label}
                                    </div>
                                </div>

                                {/* Mentions */}
                                <div class="flex items-center justify-between">
                                    <div class="text-slate-400 text-sm">Mentions</div>
                                    <div class="text-white font-semibold">{result().mentions}</div>
                                </div>

                                {/* Confidence */}
                                <div class="flex items-center justify-between">
                                    <div class="text-slate-400 text-sm">Confidence</div>
                                    <div class="text-white font-semibold">
                                        {Math.round(result().sentiment.confidence * 100)}%
                                    </div>
                                </div>

                                {/* Key Themes */}
                                <Show when={result().sentiment.keyThemes.length > 0}>
                                    <div>
                                        <div class="text-slate-400 text-xs mb-2">Key Themes</div>
                                        <div class="flex flex-wrap gap-1">
                                            {result().sentiment.keyThemes.map((theme) => (
                                                <span class="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                                                    {theme}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </Show>

                                {/* Sample Tweet */}
                                <Show when={result().tweets.length > 0}>
                                    <div>
                                        <div class="text-slate-400 text-xs mb-2">Recent Tweet</div>
                                        <div class="bg-slate-800 rounded-lg p-3">
                                            <div class="text-white text-sm italic">"{result().tweets[0].text}"</div>
                                            <div class="text-slate-500 text-xs mt-2">
                                                by @{result().tweets[0].author} · {result().tweets[0].likes} likes
                                            </div>
                                        </div>
                                    </div>
                                </Show>
                            </div>
                        )}
                    </Show>
                </div>
            </div>
        </div>
    );
}
