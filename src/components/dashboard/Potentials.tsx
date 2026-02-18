/**
 * Potentials.tsx
 * Display for tokens selected from Watchlist via DeepAgent analysis
 * Shows: image/icon, name, symbol
 */

import { For, Show } from "solid-js";

// Potential token type
export interface PotentialToken {
    id: string;
    name: string;
    symbol: string;
    icon: string;
    address: string;
}

interface PotentialsProps {
    tokens: PotentialToken[];
    onRemove?: (id: string) => void;
}

export default function Potentials(props: PotentialsProps) {
    return (
        <div class="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <div class="flex items-center gap-2 mb-4">
                <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 class="text-white text-lg font-semibold">Potentials</h3>
                <Show when={props.tokens.length > 0}>
                    <span class="ml-auto bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full">
                        {props.tokens.length}
                    </span>
                </Show>
            </div>

            <Show when={props.tokens.length === 0}>
                <div class="text-slate-500 text-sm text-center py-8">
                    No potentials yet. Analyze a token from the Watchlist to add it here.
                </div>
            </Show>

            <div class="space-y-3">
                <For each={props.tokens}>
                    {(token) => (
                        <div class="bg-slate-800/40 rounded-lg p-4 flex items-center justify-between hover:bg-slate-800/60 transition-colors">
                            <div class="flex items-center gap-3">
                                <Show when={token.icon && token.icon.startsWith("http")} fallback={
                                    <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                        {token.symbol.slice(0, 2).toUpperCase()}
                                    </div>
                                }>
                                    <img
                                        src={token.icon}
                                        alt={`${token.symbol} icon`}
                                        class="w-10 h-10 rounded-full object-cover"
                                    />
                                </Show>
                                <div>
                                    <div class="text-white font-medium">{token.symbol}</div>
                                    <Show when={token.name && token.name !== token.symbol}>
                                        <div class="text-slate-400 text-sm">{token.name}</div>
                                    </Show>
                                </div>
                            </div>

                            <Show when={props.onRemove}>
                                <button
                                    class="ml-4 text-slate-400 hover:text-red-400 transition-colors"
                                    onClick={() => props.onRemove?.(token.id)}
                                >
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </Show>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}
