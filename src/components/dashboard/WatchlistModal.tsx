import { Show } from "solid-js";

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
}

interface WatchlistModalProps {
    token: WatchlistItem;
    onClose: () => void;
    onCopy: () => void;
    copied: boolean;
    shouldShowFallback: (id: string, icon: string) => boolean;
    handleImageError: (id: string) => void;
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
                </div>
            </div>
        </div>
    );
}
