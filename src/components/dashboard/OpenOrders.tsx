import { For } from "solid-js";

interface Order {
  id: string;
  token: string;
  icon: string;
  action: string;
  amount: string;
  price: string;
  status: "Pending" | "Partial" | "Filled";
  statusColor: string;
}

export default function OpenOrders() {
  const orders: Order[] = [
    {
      id: "1",
      token: "SOL",
      icon: "SO",
      action: "BUY",
      amount: "10.5",
      price: "$94.80",
      status: "Pending",
      statusColor: "text-yellow-400"
    },
    {
      id: "2",
      token: "BONK",
      icon: "BO",
      action: "SELL",
      amount: "1,000,000",
      price: "$0.00025",
      status: "Partial",
      statusColor: "text-blue-400"
    },
    {
      id: "3",
      token: "USDC",
      icon: "US",
      action: "BUY",
      amount: "500",
      price: "$1.00",
      status: "Filled",
      statusColor: "text-green-400"
    }
  ];

  return (
    <div class="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
      <div class="flex items-center gap-2 mb-4">
        <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 class="text-white text-lg font-semibold">Open Orders</h3>
      </div>
      <div class="space-y-3">
        <For each={orders}>
          {(order) => (
            <div class="bg-slate-800/40 rounded-lg p-4 flex items-center justify-between hover:bg-slate-800/60 transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {order.icon}
                </div>
                <div>
                  <div class="text-white font-medium">{order.token}</div>
                  <div class="text-slate-400 text-sm">{order.action} {order.amount}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-white font-semibold">{order.price}</div>
                <div class={`text-sm ${order.statusColor}`}>{order.status}</div>
              </div>
              <button class="ml-4 text-slate-400 hover:text-white transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
