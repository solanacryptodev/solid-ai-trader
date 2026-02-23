/**
 * forecastReport.ts
 * Server-side utility: print Chronos forecast to console + save an HTML report.
 * Adapted from tests/integration/test_chronos.ts
 *
 * Usage (from priceStore.ts):
 *   import { saveForecastReport, printForecastReport } from "./forecastReport";
 *   printForecastReport(symbol, forecast, closePrices, rsiResult);
 *   saveForecastReport(symbol, forecast, closePrices, rsiResult);
 */

import * as fs from "fs";
import * as path from "path";
import { getFullRSI, getRSIHistoryForChart } from "./rsi";
import type { ChronosForecastResponse, RSIResult } from "./interfaces";

// Reports directory relative to CWD (project root)
const REPORTS_DIR = path.join(process.cwd(), "reports");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format a price as a human-readable dollar string with at most 2 significant
 * non-zero digits after any leading zeros.
 *
 * Examples:
 *   0.000348838  → $0.00035
 *   0.0034       → $0.0034
 *   0.25051      → $0.25
 *   1.999        → $2.00
 *   12.5         → $12.50
 */
export function formatSmartPrice(p: number): string {
  if (!isFinite(p) || p <= 0) return `$${p}`;

  // For prices >= 1 — two decimal places is sufficient
  if (p >= 1) return `$${p.toFixed(2)}`;

  // Find how many zeros follow the decimal point before the first non-zero digit.
  // e.g. 0.000348 → log10 ≈ -3.46 → floor(-log10) = 3 leading zeros → toFixed(3+2)=toFixed(5) → "0.00035"
  // e.g. 0.0034   → log10 ≈ -2.47 → floor(-log10) = 2 leading zeros → toFixed(2+2)=toFixed(4) → "0.0034"
  // e.g. 0.25     → log10 ≈ -0.60 → floor(-log10) = 0 leading zeros → toFixed(0+2)=toFixed(2) → "0.25"
  const leadingZeros = Math.floor(-Math.log10(p)); // count of zeros after "0." before first sig digit

  // +2 gives 2 significant non-zero digits after the leading zeros
  const decimals = leadingZeros + 2;
  return `$${p.toFixed(decimals)}`;
}

// Local alias kept for backward compat within this file
const formatPrice = formatSmartPrice;

function bar(value: number, max: number, width = 20): string {
  const filled = Math.round((value / max) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function rsiSignalLabel(rsi: number): string {
  if (rsi < 30) return "\x1b[32moversold\x1b[0m";
  if (rsi > 70) return "\x1b[31moverbought\x1b[0m";
  return "\x1b[90mneutral\x1b[0m";
}

/** Resolve a unique filename for the report, e.g. $SAM.html → $SAM_2.html */
function resolveFilename(symbol: string): string {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  // Sanitise symbol: strip chars that are illegal in filenames on Windows/Unix.
  const safe = symbol.replace(/[<>:"/\\|?*]/g, "_");
  const base = `$${safe}`;

  let candidate = path.join(REPORTS_DIR, `${base}.html`);
  if (!fs.existsSync(candidate)) return candidate;

  let n = 2;
  while (true) {
    candidate = path.join(REPORTS_DIR, `${base}_${n}.html`);
    if (!fs.existsSync(candidate)) return candidate;
    n++;
  }
}

// ── Console report ────────────────────────────────────────────────────────────

export function printForecastReport(
  symbol: string,
  result: ChronosForecastResponse,
  prices: number[],
  rsiResult: RSIResult
): void {
  const current = result.current_price;
  const lastRSI = rsiResult.rsi;

  console.log("\n\x1b[1m\x1b[36m╔══════════════════════════════════════════════════╗\x1b[0m");
  console.log("\x1b[1m\x1b[36m║        CHRONOS-2-SMALL — FORECAST REPORT         ║\x1b[0m");
  console.log("\x1b[1m\x1b[36m╚══════════════════════════════════════════════════╝\x1b[0m\n");

  console.log(`  Token          : ${symbol} (${result.token ?? "?"})`);
  console.log(`  Current price  : ${formatPrice(current)}`);
  console.log(`  RSI(8)         : ${lastRSI.toFixed(1)} — ${rsiSignalLabel(lastRSI)}`);
  console.log(`  EMA(9) signal  : ${rsiResult.smoothingLine?.toFixed(1) ?? "n/a"}`);
  console.log(`  Crossover      : ${rsiResult.crossover ?? "n/a"}`);
  console.log(`  Covariates     : ${result.covariates_used.join(", ") || "none"}`);
  console.log(`  Confidence     : ${(result.confidence * 100).toFixed(1)}% ${bar(result.confidence, 1)}`);

  const dirColor =
    result.direction === "bullish" ? "\x1b[32m" :
      result.direction === "bearish" ? "\x1b[31m" : "\x1b[90m";
  const dirIcon = result.direction === "bullish" ? "▲" : result.direction === "bearish" ? "▼" : "◆";
  console.log(`  Direction      : ${dirColor}${dirIcon} ${result.direction.toUpperCase()}\x1b[0m`);
  console.log(`  Δ Median       : ${result.pct_change >= 0 ? "\x1b[32m" : "\x1b[31m"}${result.pct_change >= 0 ? "+" : ""}${result.pct_change.toFixed(2)}%\x1b[0m`);

  console.log("\n  ┌─────────────────────────────────────────────────────────────────┐");
  console.log("  │ Step    Low (10%)        Median (50%)      High (90%)           │");
  console.log("  ├─────────────────────────────────────────────────────────────────┤");

  result.forecasts.forEach((f, i) => {
    const pct = ((f.median - current) / current) * 100;
    const pctStr = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
    console.log(
      `  │ +${(i + 1) * 5}min  ` +
      `${formatPrice(f.low).padEnd(16)}  ` +
      `${formatPrice(f.median).padEnd(14)}` +
      `\x1b[90m${pctStr.padEnd(8)}\x1b[0m  ` +
      `${formatPrice(f.high).padEnd(14)}` +
      `         │`
    );
  });

  console.log("  └─────────────────────────────────────────────────────────────────┘");

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

// ── HTML chart ────────────────────────────────────────────────────────────────

export function generateForecastHTML(
  symbol: string,
  result: ChronosForecastResponse,
  prices: number[],
  rsiHistory: number[],
  candleCount: number
): string {
  const n = prices.length;
  const lows = result.forecasts.map((f) => f.low);
  const medians = result.forecasts.map((f) => f.median);
  const highs = result.forecasts.map((f) => f.high);

  const histPoints = prices.map((p, i) => `{x: ${i}, y: ${p}}`).join(",");
  const foreX = medians.map((_, i) => n + i);
  const medianPoints = medians.map((p, i) => `{x: ${foreX[i]}, y: ${p}}`).join(",");
  const lowPoints = lows.map((p, i) => `{x: ${foreX[i]}, y: ${p}}`).join(",");
  const highPoints = highs.map((p, i) => `{x: ${foreX[i]}, y: ${p}}`).join(",");
  const rsiPoints = rsiHistory.map((r, i) => `{x: ${i}, y: ${r}}`).join(",");

  const dirClass = result.direction === "bullish" ? "bullish" :
    result.direction === "bearish" ? "bearish" : "neutral";

  const lastRSI = getFullRSI(prices, 8, 9, "EMA");
  const rsiSignalStr = lastRSI.rsi < 30 ? "OVERSOLD" : lastRSI.rsi > 70 ? "OVERBOUGHT" : "NEUTRAL";

  const rsiSignalClass =
    lastRSI.rsi < 30 ? "bullish" :
      lastRSI.rsi > 70 ? "bearish" : "neutral";

  const tradeSignal =
    lastRSI.rsi < 30 && result.direction === "bullish" ? "⚡ BUY — RSI oversold + Chronos bullish" :
      lastRSI.rsi > 70 && result.direction === "bearish" ? "🔴 EXIT — RSI overbought + Chronos bearish" :
        "⏳ WAIT — No confluence signal";

  const tradeSignalClass =
    lastRSI.rsi < 30 && result.direction === "bullish" ? "bullish" :
      lastRSI.rsi > 70 && result.direction === "bearish" ? "bearish" : "neutral";

  // Helper JS source injected into the HTML so Chart.js callbacks can use it.
  // Cannot use backtick template literals here (inside outer template literal).
  const fmtPJs = [
    "function fmtP(v) {",
    "  if (!isFinite(v) || v <= 0) return '$' + v;",
    "  if (v >= 1) return '$' + v.toFixed(2);",
    "  var pos = Math.floor(-Math.log10(v));",
    "  return '$' + v.toFixed(pos + 2);",
    "}",
  ].join("\n    ");

  const tableRows = result.forecasts.map((f, i) => {
    const pct = ((f.median - result.current_price) / result.current_price) * 100;
    const pctStr = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
    const cls = pct >= 0 ? "bullish" : "bearish";
    return `<tr>
            <td>+${(i + 1) * 5}min</td>
            <td class="bearish">${formatPrice(f.low)}</td>
            <td>${formatPrice(f.median)} <span class="${cls}">${pctStr}</span></td>
            <td class="bullish">${formatPrice(f.high)}</td>
        </tr>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Chronos Forecast — ${symbol}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #080c14; color: #e2e8f0; font-family: 'Courier New', monospace; padding: 28px; }
    h1   { color: #f1f5f9; font-size: 20px; margin-bottom: 4px; }
    .subtitle { color: #475569; font-size: 12px; margin-bottom: 24px; }

    /* Stats row */
    .stats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
    .stat  { background: #0a1220; border: 1px solid #1e2a3a; border-radius: 8px; padding: 12px 18px; min-width: 120px; }
    .stat-label { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 18px; color: #f8fafc; margin-top: 4px; }
    .bullish { color: #22c55e !important; }
    .bearish { color: #ef4444 !important; }
    .neutral { color: #94a3b8 !important; }

    /* Charts */
    .charts { display: flex; flex-direction: column; gap: 16px; }
    .chart-box { background: #0a1220; border: 1px solid #1e2a3a; border-radius: 12px; padding: 20px; }
    .chart-title { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; }
    canvas { max-height: 300px; }

    /* Signal / report table */
    .report { margin: 28px 0; }
    .signal-box { border: 1px solid #1e2a3a; border-radius: 8px; padding: 14px 20px; margin-bottom: 20px;
                  font-size: 15px; font-weight: bold; }
    table  { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #1e2a3a; padding: 8px 12px; text-align: left; }
    th     { background: #0a1220; color: #94a3b8; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
    td     { background: #080c14; }
    .summary { margin-top: 20px; color: #64748b; font-size: 12px; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>⚡ Chronos-2-small — ${symbol} Forecast</h1>
  <p class="subtitle">
    ${candleCount} candles context · ${result.forecasts.length} steps forecast ·
    Covariates: ${result.covariates_used.join(", ") || "none"} ·
    Generated: ${new Date().toISOString()}
  </p>

  <!-- Stats row -->
  <div class="stats">
    <div class="stat">
      <div class="stat-label">Token</div>
      <div class="stat-value">${symbol}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Current Price</div>
      <div class="stat-value">${formatPrice(result.current_price)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Direction</div>
      <div class="stat-value ${dirClass}">${result.direction.toUpperCase()}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Δ Median</div>
      <div class="stat-value">${result.pct_change >= 0 ? "+" : ""}${result.pct_change.toFixed(2)}%</div>
    </div>
    <div class="stat">
      <div class="stat-label">Confidence</div>
      <div class="stat-value">${(result.confidence * 100).toFixed(1)}%</div>
    </div>
    <div class="stat">
      <div class="stat-label">RSI(8)</div>
      <div class="stat-value ${rsiSignalClass}">${lastRSI.rsi.toFixed(1)} <small>${rsiSignalStr}</small></div>
    </div>
  </div>

  <!-- Charts -->
  <div class="charts">
    <div class="chart-box">
      <div class="chart-title">Price — History + Forecast</div>
      <canvas id="priceChart"></canvas>
    </div>
    <div class="chart-box">
      <div class="chart-title">RSI(8) — Context Window</div>
      <canvas id="rsiChart"></canvas>
    </div>
  </div>

  <!-- Report table -->
  <div class="report">
    <div class="signal-box ${tradeSignalClass}">${tradeSignal}</div>
    <table>
      <thead>
        <tr>
          <th>Step</th><th>Low (10th %)</th><th>Median (50th %)</th><th>High (90th %)</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <p class="summary">Summary: ${result.summary}</p>
  </div>

  <script>
    ${fmtPJs}
    const gridColor = "#1e2a3a";
    const tickColor = "#475569";
    const n = ${n};

    new Chart(document.getElementById("priceChart"), {
      type: "line",
      data: {
        datasets: [
          { label: "History",           data: [${histPoints}],   borderColor: "#3b82f6", borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
          { label: "Median forecast",   data: [${medianPoints}], borderColor: "#f59e0b", borderWidth: 2,   borderDash: [5,3], pointRadius: 4, pointBackgroundColor: "#f59e0b" },
          { label: "10th percentile",   data: [${lowPoints}],    borderColor: "#ef4444", borderWidth: 1,   borderDash: [3,3], pointRadius: 3 },
          { label: "90th percentile",   data: [${highPoints}],   borderColor: "#22c55e", borderWidth: 1,   borderDash: [3,3], pointRadius: 3 },
        ],
      },
      options: {
        responsive: true,
        parsing: false,
        plugins: {
          legend: { labels: { color: "#94a3b8", font: { size: 11 } } },
          tooltip: { callbacks: {
            label: ctx => ' ' + ctx.dataset.label + ': ' + fmtP(ctx.parsed.y)
          }},
        },
        scales: {
          x: { type: "linear", grid: { color: gridColor }, ticks: { color: tickColor,
            callback: v => v < n ? \`C\${v}\` : \`+\${(v - n + 1) * 5}m\`
          }},
          y: { grid: { color: gridColor }, ticks: { color: tickColor,
            callback: v => fmtP(typeof v === 'number' ? v : Number(v))
          }},
        },
      },
    });

    new Chart(document.getElementById("rsiChart"), {
      type: "line",
      data: {
        datasets: [
          { label: "RSI(8)", data: [${rsiPoints}], borderColor: "#60a5fa", borderWidth: 1.5, pointRadius: 0, fill: false },
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

// ── Save to disk ──────────────────────────────────────────────────────────────

/**
 * Generate and save the HTML forecast report for a token.
 * Calls printForecastReport to console AND writes the HTML file.
 */
export function saveForecastReport(
  symbol: string,
  result: ChronosForecastResponse,
  prices: number[],
  rsiResult: RSIResult,
  candleCount: number
): void {
  try {
    // Console output
    printForecastReport(symbol, result, prices, rsiResult);

    // HTML file
    const rsiHistory = getRSIHistoryForChart(prices, 8, prices.length);
    const html = generateForecastHTML(symbol, result, prices, rsiHistory, candleCount);
    const outPath = resolveFilename(symbol);

    fs.writeFileSync(outPath, html, "utf-8");
    console.log(`[ForecastReport] Saved → ${outPath}`);
  } catch (err) {
    console.error("[ForecastReport] Failed to save report:", err);
  }
}
