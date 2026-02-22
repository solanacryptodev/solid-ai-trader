/**
 * test_chronos.ts
 * End-to-end test for Chronos-2-small forecasting service
 * Run: npx tsx tests/integration/test_chronos.ts
 */

import { getForecast, isChronosHealthy } from "../../src/libs/chronos";
import { getFullRSI, getRSIHistoryForChart, getRSIHistory } from "../../src/libs/rsi";
import type { ChronosForecastResponse } from "../../src/libs/interfaces";
import * as fs from "fs";
import * as path from "path";

// ── Mock data ─────────────────────────────────────────────────────────────────
// 60 candles of simulated memecoin price action
// Phases: accumulation → pump → cooldown
// These are the SAME values test_chronos.py uses (seed=42 equivalent)

const MOCK_PRICES: number[] = [
  0.000270, 0.000273, 0.000276, 0.000281, 0.000285, 0.000289, 0.000294, 0.000298,
  0.000302, 0.000308, 0.000315, 0.000321, 0.000328, 0.000334, 0.000342, 0.000348,
  0.000355, 0.000361, 0.000368, 0.000374, 0.000381, 0.000388, 0.000396, 0.000403,
  // Pump starts
  0.000425, 0.000451, 0.000478, 0.000509, 0.000543, 0.000581, 0.000622, 0.000668,
  0.000718, 0.000773, 0.000835, 0.000901, 0.000972, 0.001051, 0.001136, 0.001228,
  0.001327, 0.001434, 0.001548, 0.001671,
  // Cooldown / partial dump
  0.001589, 0.001510, 0.001435, 0.001363, 0.001295, 0.001230, 0.001169, 0.001110,
  0.001055, 0.001002, 0.000952, 0.000905, 0.000859, 0.000816, 0.000776, 0.000737,
];

// Simulated "actual" future prices — what really happened after candle 60
const MOCK_ACTUAL_FUTURE: number[] = [
  0.000705,  // +5min
  0.000678,  // +10min
  0.000651,  // +15min
];

const MOCK_LIQUIDITY: number[] = Array(60).fill(0).map((_, i) =>
  25000 + i * 800 + Math.sin(i * 0.3) * 3000
);

// Calculate RSI from prices using production implementation
const MOCK_RSI: number[] = getRSIHistory(MOCK_PRICES, 8, MOCK_PRICES.length);

// ── RSI helpers ───────────────────────────────────────────────────────────────

function rsiSignal(rsi: number): string {
  if (rsi < 30) return "\x1b[32moversold\x1b[0m";
  if (rsi > 70) return "\x1b[31moverbought\x1b[0m";
  return "\x1b[90mneutral\x1b[0m";
}

function formatPrice(p: number): string {
  return p < 0.001 ? `$${p.toExponential(4)}` : `$${p.toFixed(8)}`;
}

function bar(value: number, max: number, width = 20): string {
  const filled = Math.round((value / max) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

// ── Console reporter ──────────────────────────────────────────────────────────

function printReport(result: ChronosForecastResponse) {
  const current = result.current_price;

  // Use production RSI implementation — same as live system will use
  const rsiResult = getFullRSI(MOCK_PRICES, 8, 9, "EMA");
  const lastRSI = rsiResult.rsi;

  console.log("\n\x1b[1m\x1b[36m╔══════════════════════════════════════════════════╗\x1b[0m");
  console.log("\x1b[1m\x1b[36m║        CHRONOS-2-SMALL — FORECAST REPORT         ║\x1b[0m");
  console.log("\x1b[1m\x1b[36m╚══════════════════════════════════════════════════╝\x1b[0m\n");

  console.log(`  Token          : ${result.token ?? "MOCK_TOKEN"}`);
  console.log(`  Current price  : ${formatPrice(current)}`);
  console.log(`  RSI(8)         : ${lastRSI.toFixed(1)} — ${rsiSignal(lastRSI)}`);
  console.log(`  EMA(9) signal  : ${rsiResult.smoothingLine?.toFixed(1) ?? "n/a"}`);
  console.log(`  Crossover      : ${rsiResult.crossover ?? "n/a"}`);
  console.log(`  Covariates     : ${result.covariates_used.join(", ") || "none"}`);
  console.log(`  Confidence     : ${(result.confidence * 100).toFixed(1)}% ${bar(result.confidence, 1)}`);

  const dirColor = result.direction === "bullish" ? "\x1b[32m" : result.direction === "bearish" ? "\x1b[31m" : "\x1b[90m";
  const dirIcon = result.direction === "bullish" ? "▲" : result.direction === "bearish" ? "▼" : "◆";
  console.log(`  Direction      : ${dirColor}${dirIcon} ${result.direction.toUpperCase()}\x1b[0m`);
  console.log(`  Δ Median       : ${result.pct_change >= 0 ? "\x1b[32m" : "\x1b[31m"}${result.pct_change >= 0 ? "+" : ""}${result.pct_change.toFixed(2)}%\x1b[0m`);

  console.log("\n  ┌─────────────────────────────────────────────────────────────────┐");
  console.log("  │ Step    Low (10%)        Median (50%)      High (90%)    Actual │");
  console.log("  ├─────────────────────────────────────────────────────────────────┤");

  result.forecasts.forEach((f, i) => {
    const actual = MOCK_ACTUAL_FUTURE[i];
    const pct = (f.median - current) / current * 100;
    const err = actual ? ` (${((actual - f.median) / f.median * 100).toFixed(1)}% off)` : "";
    const actStr = actual ? formatPrice(actual) : "n/a";
    const pctStr = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;

    console.log(
      `  │ +${(i + 1) * 5}min  ` +
      `${formatPrice(f.low).padEnd(16)}  ` +
      `${formatPrice(f.median).padEnd(14)}` +
      `\x1b[90m${pctStr.padEnd(8)}\x1b[0m  ` +
      `${formatPrice(f.high).padEnd(14)}` +
      `\x1b[35m${actStr}\x1b[90m${err}\x1b[0m`.padEnd(22) +
      ` │`
    );
  });

  console.log("  └─────────────────────────────────────────────────────────────────┘");

  // Signal verdict
  const isOversold = lastRSI < 30;
  const isBullish = result.direction === "bullish";
  console.log("\n  ── Signal ──────────────────────────────────");
  if (isOversold && isBullish) {
    console.log("  \x1b[1m\x1b[32m⚡ BUY — RSI oversold + Chronos bullish\x1b[0m");
  } else if (lastRSI > 70 && result.direction === "bearish") {
    console.log("  \x1b[1m\x1b[31m🔴 EXIT — RSI overbought + Chronos bearish\x1b[0m");
  } else {
    console.log("  \x1b[90m⏳ WAIT — No confluence signal\x1b[0m");
  }

  console.log(`\n  Summary: \x1b[90m${result.summary}\x1b[0m\n`);
}

// ── HTML chart generator ──────────────────────────────────────────────────────

function generateHTMLChart(result: ChronosForecastResponse): string {
  const prices = MOCK_PRICES;
  const rsi = getRSIHistoryForChart(MOCK_PRICES, 8, MOCK_PRICES.length);
  const lows = result.forecasts.map(f => f.low);
  const medians = result.forecasts.map(f => f.median);
  const highs = result.forecasts.map(f => f.high);
  const actual = MOCK_ACTUAL_FUTURE;
  const n = prices.length;

  // Build chart data points
  const histPoints = prices.map((p, i) => `{x: ${i}, y: ${p}}`).join(",");
  const foreX = medians.map((_, i) => n + i);
  const medianPoints = medians.map((p, i) => `{x: ${foreX[i]}, y: ${p}}`).join(",");
  const lowPoints = lows.map((p, i) => `{x: ${foreX[i]}, y: ${p}}`).join(",");
  const highPoints = highs.map((p, i) => `{x: ${foreX[i]}, y: ${p}}`).join(",");
  const actualPoints = actual.map((p, i) => `{x: ${foreX[i]}, y: ${p}}`).join(",");
  const rsiPoints = rsi.map((r, i) => `{x: ${i}, y: ${r}}`).join(",");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Chronos-2-small Forecast Test</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #080c14; color: #e2e8f0; font-family: 'Courier New', monospace; padding: 24px; }
    h1 { color: #f1f5f9; font-size: 18px; margin-bottom: 4px; }
    .subtitle { color: #475569; font-size: 12px; margin-bottom: 24px; }
    .charts { display: flex; flex-direction: column; gap: 16px; }
    .chart-box { background: #0a1220; border: 1px solid #1e2a3a; border-radius: 12px; padding: 20px; }
    .chart-title { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; }
    .stats { display: flex; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
    .stat { background: #0a1220; border: 1px solid #1e2a3a; border-radius: 8px; padding: 12px 18px; }
    .stat-label { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 18px; color: #f8fafc; margin-top: 4px; }
    .bullish { color: #22c55e !important; }
    .bearish { color: #ef4444 !important; }
    .neutral { color: #94a3b8 !important; }
    canvas { max-height: 300px; }
  </style>
</head>
<body>
  <h1>⚡ Chronos-2-small — Forecast Test Result</h1>
  <p class="subtitle">Mock memecoin · ${n} candles context · ${result.forecasts.length} candles forecast · Covariates: ${result.covariates_used.join(", ") || "none"}</p>

  <div class="stats">
    <div class="stat">
      <div class="stat-label">Current Price</div>
      <div class="stat-value">${formatPrice(result.current_price)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Direction</div>
      <div class="stat-value ${result.direction}">${result.direction.toUpperCase()}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Δ Median</div>
      <div class="stat-value ${result.pct_change >= 0 ? "bearish" : "bullish"}">${result.pct_change >= 0 ? "+" : ""}${result.pct_change.toFixed(2)}%</div>
    </div>
    <div class="stat">
      <div class="stat-label">Confidence</div>
      <div class="stat-value">${(result.confidence * 100).toFixed(1)}%</div>
    </div>
  </div>

  <div class="charts">
    <div class="chart-box">
      <div class="chart-title">Price — History + Forecast vs Actual</div>
      <canvas id="priceChart"></canvas>
    </div>
    <div class="chart-box">
      <div class="chart-title">RSI(8) — Context Window</div>
      <canvas id="rsiChart"></canvas>
    </div>
  </div>

  <script>
    const gridColor  = "#1e2a3a";
    const tickColor  = "#475569";

    // ── Price chart ──
    new Chart(document.getElementById("priceChart"), {
      type: "line",
      data: {
        datasets: [
          {
            label: "History",
            data: [${histPoints}],
            borderColor: "#3b82f6",
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
          },
          {
            label: "Median forecast",
            data: [${medianPoints}],
            borderColor: "#f59e0b",
            borderWidth: 2,
            borderDash: [5, 3],
            pointRadius: 4,
            pointBackgroundColor: "#f59e0b",
          },
          {
            label: "10th percentile",
            data: [${lowPoints}],
            borderColor: "#ef4444",
            borderWidth: 1,
            borderDash: [3, 3],
            pointRadius: 3,
          },
          {
            label: "90th percentile",
            data: [${highPoints}],
            borderColor: "#22c55e",
            borderWidth: 1,
            borderDash: [3, 3],
            pointRadius: 3,
          },
          {
            label: "Actual (what happened)",
            data: [${actualPoints}],
            borderColor: "#a78bfa",
            borderWidth: 2,
            pointRadius: 5,
            pointBackgroundColor: "#a78bfa",
          },
        ],
      },
      options: {
        responsive: true,
        parsing: false,
        plugins: {
          legend: { labels: { color: "#94a3b8", font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y;
                return \` \${ctx.dataset.label}: \${v < 0.001 ? v.toExponential(4) : "$" + v.toFixed(8)}\`;
              }
            }
          }
        },
        scales: {
          x: { type: "linear", grid: { color: gridColor }, ticks: { color: tickColor,
            callback: v => v < ${n} ? \`C\${v}\` : \`+\${(v-${n}+1)*5}m\`
          }},
          y: { grid: { color: gridColor }, ticks: { color: tickColor,
            callback: v => v < 0.001 ? v.toExponential(2) : "$" + v.toFixed(6)
          }},
        },
        annotation: {
          annotations: { line1: { type: "line", xMin: ${n - 0.5}, xMax: ${n - 0.5},
            borderColor: "#334155", borderWidth: 2
          }}
        }
      },
    });

    // ── RSI chart ──
    new Chart(document.getElementById("rsiChart"), {
      type: "line",
      data: {
        datasets: [
          {
            label: "RSI(8)",
            data: [${rsiPoints}],
            borderColor: "#60a5fa",
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        parsing: false,
        plugins: {
          legend: { labels: { color: "#94a3b8", font: { size: 11 } } },
          annotation: {
            annotations: {
              ob: { type: "line", yMin: 70, yMax: 70, borderColor: "#ef444480", borderWidth: 1, borderDash: [4,4] },
              os: { type: "line", yMin: 30, yMax: 30, borderColor: "#22c55e80", borderWidth: 1, borderDash: [4,4] },
            }
          }
        },
        scales: {
          x: { type: "linear", grid: { color: gridColor }, ticks: { color: tickColor, callback: v => \`C\${v}\` }},
          y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: tickColor }},
        },
      },
    });
  </script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\x1b[1m\x1b[36m\nChronos-2-small TypeScript Client Test\x1b[0m");
  console.log("──────────────────────────────────");

  // Step 1: health check
  process.stdout.write("  Checking Chronos-2-small service health... ");
  const healthy = await isChronosHealthy();
  if (!healthy) {
    console.log("\x1b[31m✗ OFFLINE\x1b[0m");
    console.log("\n  ❌ server.py is not running. Start it first:\n");
    console.log("     cd python && python server.py\n");
    process.exit(1);
  }
  console.log("\x1b[32m✓ Online\x1b[0m");

  // Step 2: send forecast request
  console.log(`  Sending ${MOCK_PRICES.length} candles + RSI + liquidity covariates...`);
  const result = await getForecast({
    prices: MOCK_PRICES,
    rsi_history: MOCK_RSI,
    liquidity_history: MOCK_LIQUIDITY,
    prediction_length: 3,
    token: "MOCK_TOKEN_TEST",
  });

  if (!result) {
    console.log("\n  ❌ Forecast failed — check server.py logs\n");
    process.exit(1);
  }

  // Step 3: console report
  printReport(result);

  // Step 4: save HTML chart
  const html = generateHTMLChart(result);
  const outPath = path.join(process.cwd(), "chronos_test_result.html");
  fs.writeFileSync(outPath, html);
  console.log(`  Chart saved → ${outPath}`);
  console.log("  Open it in your browser to see the visual result.\n");
  console.log("\x1b[32m✅ Test complete.\x1b[0m\n");
}

main().catch(err => {
  console.error("\n❌ Unexpected error:", err);
  process.exit(1);
});
