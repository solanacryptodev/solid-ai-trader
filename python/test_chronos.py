"""
test_chronos.py
Test Chronos-2 model directly (no HTTP) for memecoin price forecasting.
Run: python test_chronos.py
"""

import torch
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from datetime import datetime, timezone
import random


def generate_memecoin_prices(n_history: int, n_future: int, seed: int = 42):
    """Generate realistic memecoin-style price data with accumulation, pump, and cooldown phases."""
    random.seed(seed)
    np.random.seed(seed)
    prices = [0.000800]

    # Phase 1: Sharp dump (0-35%)
    # Token already peaked, early holders selling hard
    dump_end = int(n_history * 0.35)
    for _ in range(dump_end):
        drift = -0.035
        noise = random.gauss(0, 0.018)
        prices.append(max(0.000001, prices[-1] * (1 + drift + noise)))

    # Phase 2: Fake recovery / dead cat bounce (35-60%)
    # RSI was oversold from dump, now bouncing — looks like reversal
    # Price recovers ~20-25% of dump, RSI climbs back to 40-50
    # Retail sees "oversold + green candles" and buys — the trap
    bounce_end = int(n_history * 0.60)
    for _ in range(bounce_end - dump_end):
        drift = 0.018
        noise = random.gauss(0, 0.012)
        prices.append(max(0.000001, prices[-1] * (1 + drift + noise)))

    # Phase 3: Resumption of dump (60-100%)
    # Bounce exhausted, sellers return, breaks below bounce low
    # RSI rolls back over — second leg down
    for _ in range(n_history - bounce_end):
        drift = -0.028
        noise = random.gauss(0, 0.022)
        prices.append(max(0.000001, prices[-1] * (1 + drift + noise)))

    history = prices[:n_history]

    # Future: dump continues — the trap springs
    future = []
    last = history[-1]
    for _ in range(n_future):
        drift = random.uniform(-0.025, -0.008)
        noise = random.gauss(0, 0.015)
        last  = max(0.000001, last * (1 + drift + noise))
        future.append(last)

    return history, future


def generate_rsi(prices: list, period: int = 8):
    """Calculate RSI from price history."""
    rsi_vals = [50.0] * period
    deltas = [prices[i+1] - prices[i] for i in range(len(prices)-1)]
    gains = [max(d, 0) for d in deltas]
    losses = [max(-d, 0) for d in deltas]

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period-1) + gains[i]) / period
        avg_loss = (avg_loss * (period-1) + losses[i]) / period
        rs = avg_gain / avg_loss if avg_loss > 0 else 100
        rsi = 100 - (100 / (1 + rs))
        rsi_vals.append(rsi)

    return rsi_vals[:len(prices)]


def run_forecast(history, rsi_history, prediction_length=3):
    """Load Chronos-2 model and run forecast."""
    print("\n[1/3] Loading Chronos-2-small...")
    from chronos import Chronos2Pipeline

    pipeline = Chronos2Pipeline.from_pretrained(
        "autogluon/chronos-2-small",
        device_map="cpu",
        dtype=torch.float32,
    )
    print("Model loaded")

    # Ensure all sequences are the same length
    n = min(len(history), len(rsi_history))
    history = history[:n]
    rsi_history = rsi_history[:n]

    ts = pd.date_range(end=datetime.now(timezone.utc), periods=n, freq="5min")

    context_df = pd.DataFrame({
        "item_id": ["MOCK_TOKEN"] * n,
        "timestamp": ts,
        "target": history,
        "rsi": rsi_history,
    })

    print(f"\n[2/3] Running forecast on {n} candles...")
    pred_df = pipeline.predict_df(
        context_df,
        prediction_length=prediction_length,
        quantile_levels=[0.1, 0.5, 0.9],
        id_column="item_id",
        timestamp_column="timestamp",
        target="target",
    )

    rows = pred_df.sort_values("timestamp")
    lows = [float(r["0.1"]) for _, r in rows.iterrows()]
    medians = [float(r["0.5"]) for _, r in rows.iterrows()]
    highs = [float(r["0.9"]) for _, r in rows.iterrows()]

    return lows, medians, highs


def print_results(history, future, lows, medians, highs):
    """Print forecast results."""
    current = history[-1]

    print("\n[3/3] Results")
    print("-" * 60)
    print(f"  Context candles : {len(history)}")
    print(f"  Current price  : ${current:.8f}")
    print(f"  Forecast steps : {len(medians)} x 5min\n")

    for i, (lo, med, hi) in enumerate(zip(lows, medians, highs)):
        actual = future[i] if i < len(future) else None
        act_str = f"${actual:.8f}" if actual else "n/a"
        act_err = f"  ({(actual - med)/med*100:+.1f}% off)" if actual else ""
        print(f"  +{(i+1)*5}min  ${lo:.8f} ${med:.8f} ${hi:.8f} {act_str}{act_err}")

    final_pct = (medians[-1] - current) / current * 100
    direction = "BULLISH" if final_pct > 1 else "BEARISH" if final_pct < -1 else "NEUTRAL"
    avg_spread = sum((h-l)/current for h,l in zip(highs,lows)) / len(highs)
    confidence = max(0, min(1, 1 - avg_spread))

    print(f"\n  Direction   : {direction}")
    print(f"  Delta       : {final_pct:+.2f}%")
    print(f"  Confidence  : {confidence*100:.1f}%")
    print("-" * 60)


def render_chart(history, future, lows, medians, highs, rsi, out_path="chronos_test_result.png"):
    """Render chart with forecast results."""
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 9), gridspec_kw={"height_ratios": [3, 1]})
    fig.patch.set_facecolor("#080c14")

    for ax in (ax1, ax2):
        ax.set_facecolor("#0a1220")
        ax.tick_params(colors="#64748b")
        ax.spines[:].set_color("#1e2a3a")

    n_hist = len(history)
    n_fore = len(medians)
    hist_x = list(range(n_hist))
    fore_x = list(range(n_hist, n_hist + n_fore))
    future_x = list(range(n_hist, n_hist + len(future)))

    ax1.plot(hist_x, history, color="#3b82f6", linewidth=1.5, label="History", zorder=3)
    ax1.fill_between(fore_x, lows, highs, color="#f59e0b", alpha=0.15, label="10-90% band", zorder=2)
    ax1.plot(fore_x, medians, color="#f59e0b", linewidth=2, linestyle="--", marker="o", markersize=5, label="Median forecast", zorder=4)
    ax1.plot(fore_x, lows, color="#ef4444", linewidth=1, linestyle=":", label="10th pct", zorder=3)
    ax1.plot(fore_x, highs, color="#22c55e", linewidth=1, linestyle=":", label="90th pct", zorder=3)

    if future:
        ax1.plot(future_x, future[:n_fore], color="#a78bfa", linewidth=2, marker="s", markersize=5, label="Actual", zorder=5)

    ax1.axvline(x=n_hist - 0.5, color="#334155", linewidth=1.5, linestyle="-", zorder=1)
    ax1.set_title("Chronos-2-small - Memecoin Forecast Test", color="#f1f5f9", fontsize=14, fontweight="bold", pad=12)
    ax1.set_ylabel("Price (USD)", color="#94a3b8", fontsize=10)
    ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"${x:.6f}"))
    ax1.legend(facecolor="#0f1826", edgecolor="#1e2a3a", labelcolor="#94a3b8", fontsize=9)
    ax2.plot(hist_x, rsi, color="#60a5fa", linewidth=1.2, label="RSI(8)")
    ax2.axhline(y=70, color="#ef4444", linewidth=0.8, linestyle="--", alpha=0.6)
    ax2.axhline(y=30, color="#22c55e", linewidth=0.8, linestyle="--", alpha=0.6)
    ax2.set_ylim(0, 100)
    ax2.set_ylabel("RSI", color="#94a3b8", fontsize=9)
    ax2.set_xlabel("Candle (5-min intervals)", color="#94a3b8", fontsize=9)
    ax2.legend(facecolor="#0f1826", edgecolor="#1e2a3a", labelcolor="#94a3b8", fontsize=8)
    ax2.grid(color="#1e2a3a", linewidth=0.5, alpha=0.5)
    ax2.axvline(x=n_hist - 0.5, color="#334155", linewidth=1.5, linestyle="-")

    plt.tight_layout(pad=2.0)
    plt.savefig(out_path, dpi=150, bbox_inches="tight", facecolor="#080c14")
    print(f"\n  Chart saved -> {out_path}")


if __name__ == "__main__":
    N_HISTORY = 60
    N_FUTURE = 3

    print("=" * 60)
    print("  Chronos-2-small - Local Test")
    print(f"  Context: {N_HISTORY} x 5min candles")
    print(f"  Forecast: {N_FUTURE} steps ahead (15 min)")
    print("=" * 60)

    history, future = generate_memecoin_prices(N_HISTORY, N_FUTURE, seed=42)
    rsi_history = generate_rsi(history)

    # Trim both to the same length before anything else
    n = min(len(history), len(rsi_history))
    history = history[:n]
    rsi_history = rsi_history[:n]

    lows, medians, highs = run_forecast(history, rsi_history, prediction_length=N_FUTURE)

    print_results(history, future, lows, medians, highs)
    render_chart(history, future, lows, medians, highs, rsi_history)

    print("\nTest complete.\n")
