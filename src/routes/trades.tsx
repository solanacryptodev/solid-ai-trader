import { Show } from "solid-js";

// Trade type interface
interface Trade {
    token: string;
    tokenSymbol: string;
    entryDate: string;
    entryTime: string;
    exitDate: string;
    exitTime: string;
    entryAmount: number;
    pnlDollars: number;
    pnlPercent: number;
    status: "Active" | "Finalized";
}

// Mock data for current trades
const currentTrades: Trade[] = [
    {
        token: "SEXT",
        tokenSymbol: "PMPR",
        entryDate: "Oct 27, 2023",
        entryTime: "14:30:00",
        exitDate: "-",
        exitTime: "-",
        entryAmount: 1000,
        pnlDollars: 125.50,
        pnlPercent: 12.55,
        status: "Active"
    },
    {
        token: "SEXT",
        tokenSymbol: "TripleT",
        entryDate: "Oct 27, 2023",
        entryTime: "15:45:12",
        exitDate: "-",
        exitTime: "-",
        entryAmount: 500,
        pnlDollars: -15.00,
        pnlPercent: -3.00,
        status: "Active"
    },
    {
        token: "SEXT",
        tokenSymbol: "CLAWAPI",
        entryDate: "Oct 27, 2023",
        entryTime: "16:00:00",
        exitDate: "-",
        exitTime: "-",
        entryAmount: 2500,
        pnlDollars: 500.00,
        pnlPercent: 20.00,
        status: "Active"
    },
    {
        token: "AGGRO",
        tokenSymbol: "SOL",
        entryDate: "Oct 27, 2023",
        entryTime: "17:15:30",
        exitDate: "-",
        exitTime: "-",
        entryAmount: 100,
        pnlDollars: 2.50,
        pnlPercent: 2.50,
        status: "Active"
    }
];

// Mock data for finalized trades
const finalizedTrades: Trade[] = [
    {
        token: "PEPE",
        tokenSymbol: "PEPE",
        entryDate: "Oct 26, 2023",
        entryTime: "10:30:00",
        exitDate: "Oct 26, 2023",
        exitTime: "14:45:00",
        entryAmount: 2000,
        pnlDollars: 650.00,
        pnlPercent: 22.50,
        status: "Finalized"
    },
    {
        token: "BONK",
        tokenSymbol: "BONK",
        entryDate: "Oct 25, 2023",
        entryTime: "09:15:00",
        exitDate: "Oct 26, 2023",
        exitTime: "11:20:00",
        entryAmount: 500,
        pnlDollars: -75.00,
        pnlPercent: -15.00,
        status: "Finalized"
    },
    {
        token: "WIF",
        tokenSymbol: "WIF",
        entryDate: "Oct 24, 2023",
        entryTime: "14:00:00",
        exitDate: "Oct 25, 2023",
        exitTime: "16:30:00",
        entryAmount: 1000,
        pnlDollars: 200.00,
        pnlPercent: 20.00,
        status: "Finalized"
    },
    {
        token: "BONK",
        tokenSymbol: "BONK",
        entryDate: "Oct 23, 2023",
        entryTime: "11:45:00",
        exitDate: "Oct 24, 2023",
        exitTime: "09:00:00",
        entryAmount: 750,
        pnlDollars: -30.00,
        pnlPercent: -4.00,
        status: "Finalized"
    },
    {
        token: "SOL",
        tokenSymbol: "SOL",
        entryDate: "Oct 22, 2023",
        entryTime: "08:30:00",
        exitDate: "Oct 23, 2023",
        exitTime: "10:15:00",
        entryAmount: 3000,
        pnlDollars: 450.00,
        pnlPercent: 15.00,
        status: "Finalized"
    },
    {
        token: "JTO",
        tokenSymbol: "JTO",
        entryDate: "Oct 21, 2023",
        entryTime: "12:00:00",
        exitDate: "Oct 22, 2023",
        exitTime: "15:30:00",
        entryAmount: 1500,
        pnlDollars: 225.00,
        pnlPercent: 15.00,
        status: "Finalized"
    },
    {
        token: "ORCA",
        tokenSymbol: "ORCA",
        entryDate: "Oct 20, 2023",
        entryTime: "09:00:00",
        exitDate: "Oct 21, 2023",
        exitTime: "11:45:00",
        entryAmount: 800,
        pnlDollars: -40.00,
        pnlPercent: -5.00,
        status: "Finalized"
    },
    {
        token: "RAY",
        tokenSymbol: "RAY",
        entryDate: "Oct 19, 2023",
        entryTime: "16:30:00",
        exitDate: "Oct 20, 2023",
        exitTime: "09:15:00",
        entryAmount: 2000,
        pnlDollars: 180.00,
        pnlPercent: 9.00,
        status: "Finalized"
    },
    {
        token: "SRM",
        tokenSymbol: "SRM",
        entryDate: "Oct 18, 2023",
        entryTime: "11:00:00",
        exitDate: "Oct 19, 2023",
        exitTime: "14:20:00",
        entryAmount: 600,
        pnlDollars: -90.00,
        pnlPercent: -15.00,
        status: "Finalized"
    },
    {
        token: "STEP",
        tokenSymbol: "STEP",
        entryDate: "Oct 17, 2023",
        entryTime: "13:45:00",
        exitDate: "Oct 18, 2023",
        exitTime: "10:00:00",
        entryAmount: 1200,
        pnlDollars: 144.00,
        pnlPercent: 12.00,
        status: "Finalized"
    },
    {
        token: "MNGO",
        tokenSymbol: "MNGO",
        entryDate: "Oct 16, 2023",
        entryTime: "08:00:00",
        exitDate: "Oct 17, 2023",
        exitTime: "12:30:00",
        entryAmount: 900,
        pnlDollars: 45.00,
        pnlPercent: 5.00,
        status: "Finalized"
    }
];

// Token icon component
function TokenIcon({ symbol }: { symbol: string }) {
    const icons: Record<string, string> = {
        PMPR: "https://placehold.co/24x24/0ea5e9/ffffff?text=P",
        TripleT: "https://placehold.co/24x24/8b5cf6/ffffff?text=T",
        CLAWAPI: "https://placehold.co/24x24/ec4899/ffffff?text=C",
        SOL: "https://placehold.co/24x24/9945ff/ffffff?text=S",
        PEPE: "https://placehold.co/24x24/22c55e/ffffff?text=P",
        BONK: "https://placehold.co/24x24/f97316/ffffff?text=B",
        WIF: "https://placehold.co/24x24/f59e0b/ffffff?text=W",
        JTO: "https://placehold.co/24x24/14b8a6/ffffff?text=J",
        ORCA: "https://placehold.co/24x24/06b6d4/ffffff?text=O",
        RAY: "https://placehold.co/24x24/8b5cf6/ffffff?text=R",
        SRM: "https://placehold.co/24x24/f43f5e/ffffff?text=S",
        STEP: "https://placehold.co/24x24/22c55e/ffffff?text=S",
        MNGO: "https://placehold.co/24x24/eab308/ffffff?text=M"
    };

    return (
        <img
            src={icons[symbol] || "https://placehold.co/24x24/475569/ffffff?text=?"}
            alt={symbol}
            class="w-6 h-6 rounded-full"
        />
    );
}

export default function Trades() {
    const formatPnl = (value: number) => {
        const color = value >= 0 ? "text-emerald-400" : "text-rose-400";
        const sign = value >= 0 ? "+" : "";
        return (
            <span class={color}>
                {sign}${value.toFixed(2)}
            </span>
        );
    };

    const formatPnlPercent = (value: number) => {
        const color = value >= 0 ? "text-emerald-400" : "text-rose-400";
        const sign = value >= 0 ? "+" : "";
        return (
            <span class={color}>
                {sign}{value.toFixed(2)}%
            </span>
        );
    };

    return (
        <main class="min-h-screen p-6" style="background-color: #0a0e1a;">
            <div class="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div class="flex items-center justify-between">
                    <h1 class="text-3xl font-bold text-white">Trades</h1>
                    <div class="flex items-center space-x-4">
                        <button class="flex items-center px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
                            </svg>
                            Filter
                        </button>
                        <button class="flex items-center px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-colors">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                            </svg>
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Current Trades Section */}
                <div>
                    <div class="flex items-center space-x-3 mb-4">
                        <h2 class="text-xl font-semibold text-white">Current Trades</h2>
                        <span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm">
                            {currentTrades.length} Active
                        </span>
                    </div>

                    <div class="rounded-lg overflow-hidden" style="background-color: #111827; border: 1px solid #1f2937;">
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-gray-700 sticky top-0" style="background-color: #000000;">
                                    <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Token</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Entry Date & Time</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Exit Date & Time</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Entry Amount</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">PNL ($)</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">PNL (%)</th>
                                    <th class="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                        </table>
                        <div class="max-h-64 overflow-y-auto">
                            <table class="w-full">
                                <tbody>
                                    <Show when={currentTrades.length > 0}>
                                        {currentTrades.map((trade) => (
                                            <tr class="border-b border-gray-700 hover:bg-gray-800/50 transition-colors">
                                                <td class="px-6 py-4 whitespace-nowrap">
                                                    <div class="flex items-center">
                                                        <TokenIcon symbol={trade.tokenSymbol} />
                                                        <div class="ml-3">
                                                            <div class="text-sm font-medium text-white">{trade.tokenSymbol}</div>
                                                            <div class="text-xs text-gray-400">{trade.token}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap">
                                                    <div class="text-sm text-gray-300">{trade.entryDate}</div>
                                                    <div class="text-xs text-gray-500">{trade.entryTime}</div>
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap">
                                                    <div class="text-sm text-gray-500">{trade.exitDate}</div>
                                                    <div class="text-xs text-gray-600">{trade.exitTime}</div>
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap text-right">
                                                    <div class="text-sm text-gray-300">${trade.entryAmount.toFixed(2)}</div>
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap text-right">
                                                    {formatPnl(trade.pnlDollars)}
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap text-right">
                                                    {formatPnlPercent(trade.pnlPercent)}
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap text-center">
                                                    <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-500/20 text-emerald-400">
                                                        Active
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </Show>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Finalized Trades Section */}
                <div>
                    <div class="flex items-center space-x-3 mb-4">
                        <h2 class="text-xl font-semibold text-white">Finalized Trades</h2>
                        <span class="px-3 py-1 rounded-full bg-gray-600/30 text-gray-400 text-sm">
                            {finalizedTrades.length} Finalized
                        </span>
                    </div>

                    <div class="rounded-lg overflow-hidden" style="background-color: #111827; border: 1px solid #1f2937;">
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-gray-700 sticky top-0" style="background-color: #000000;">
                                    <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Token</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Entry Date & Time</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Exit Date & Time</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Entry Amount</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">PNL ($)</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">PNL (%)</th>
                                    <th class="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                        </table>
                        <div class="max-h-64 overflow-y-auto">
                            <table class="w-full">
                                <tbody>
                                    <Show when={finalizedTrades.length > 0}>
                                        {finalizedTrades.map((trade) => (
                                            <tr class="border-b border-gray-700 hover:bg-gray-800/50 transition-colors">
                                                <td class="px-6 py-4 whitespace-nowrap">
                                                    <div class="flex items-center">
                                                        <TokenIcon symbol={trade.tokenSymbol} />
                                                        <div class="ml-3">
                                                            <div class="text-sm font-medium text-white">{trade.tokenSymbol}</div>
                                                            <div class="text-xs text-gray-400">{trade.token}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap">
                                                    <div class="text-sm text-gray-300">{trade.entryDate}</div>
                                                    <div class="text-xs text-gray-500">{trade.entryTime}</div>
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap">
                                                    <div class="text-sm text-gray-300">{trade.exitDate}</div>
                                                    <div class="text-xs text-gray-500">{trade.exitTime}</div>
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap text-right">
                                                    <div class="text-sm text-gray-300">${trade.entryAmount.toFixed(2)}</div>
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap text-right">
                                                    {formatPnl(trade.pnlDollars)}
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap text-right">
                                                    {formatPnlPercent(trade.pnlPercent)}
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap text-center">
                                                    <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-600/30 text-gray-400">
                                                        Finalized
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </Show>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
