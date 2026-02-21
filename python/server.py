"""
Chronos-2-small HTTP Microservice
Upgraded from Chronos-Bolt-Base to Chronos-2-small with full covariate support.

Install:
    pip install fastapi uvicorn pandas pyarrow numpy torch
    pip install git+https://github.com/amazon-science/chronos-forecasting.git

Run:
    python server.py  ->  http://localhost:8000
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np
import torch
import uvicorn
import logging
from typing import Optional
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Chronos-2-small Trading Service")

# ── Model ─────────────────────────────────────────────────────────────────────

pipeline = None


@app.on_event("startup")
async def load_model():
    global pipeline
    logger.info("Loading Chronos-2-small (~32M params, downloading on first run)...")
    from chronos import Chronos2Pipeline

    pipeline = Chronos2Pipeline.from_pretrained(
        "autogluon/chronos-2-small",
        device_map="cpu",  # swap to "cuda" if you add a GPU
        torch_dtype=torch.float32,
    )
    logger.info("Chronos-2-small ready.")


# ── Schemas ───────────────────────────────────────────────────────────────────


class ForecastRequest(BaseModel):
    prices: list[float]  # close price per candle (required)
    token: Optional[str] = None

    # Past covariates — optional but improve accuracy significantly
    rsi_history: Optional[list[float]] = None  # RSI(8) aligned to prices
    liquidity_history: Optional[list[float]] = None  # USD liquidity per candle
    volume_history: Optional[list[float]] = None  # volume per candle
    buy_pressure: Optional[list[float]] = None  # buy/sell ratio per candle

    prediction_length: int = 3  # candles ahead  (3 * 5min = 15 min lookahead)
    candle_minutes: int = 5  # used to generate synthetic timestamps


class QuantileForecast(BaseModel):
    low: float  # 10th pct — bear case
    median: float  # 50th pct — base case
    high: float  # 90th pct — bull case


class ForecastResponse(BaseModel):
    token: Optional[str]
    current_price: float
    forecasts: list[QuantileForecast]
    direction: str  # "bullish" | "bearish" | "neutral"
    confidence: float  # 0-1
    pct_change: float  # median % change vs current price
    covariates_used: list[str]
    summary: str


# ── Helpers ───────────────────────────────────────────────────────────────────


def _align(arr: Optional[list[float]], length: int) -> Optional[list[float]]:
    """Trim or front-pad a covariate array to match target length."""
    if arr is None:
        return None
    if len(arr) >= length:
        return arr[-length:]
    return [arr[0]] * (length - len(arr)) + arr


def _build_context_df(req: ForecastRequest):
    n = len(req.prices)
    end = datetime.utcnow().replace(second=0, microsecond=0)
    ts = pd.date_range(end=end, periods=n, freq=f"{req.candle_minutes}min")

    df = pd.DataFrame(
        {
            "item_id": req.token or "token",
            "timestamp": ts,
            "target": req.prices,
        }
    )

    covariates_used = []
    for col, arr in [
        ("rsi", req.rsi_history),
        ("liquidity", req.liquidity_history),
        ("volume", req.volume_history),
        ("buy_pressure", req.buy_pressure),
    ]:
        aligned = _align(arr, n)
        if aligned is not None:
            df[col] = aligned
            covariates_used.append(col)

    return df, covariates_used


# ── Forecast ──────────────────────────────────────────────────────────────────


@app.post("/forecast", response_model=ForecastResponse)
async def forecast(req: ForecastRequest):
    if pipeline is None:
        raise HTTPException(503, "Model not loaded yet")
    if len(req.prices) < 15:
        raise HTTPException(400, f"Need >= 15 price points, got {len(req.prices)}")

    # ── Request log ──────────────────────────────────────
    logger.info(
        f"[FORECAST] token={req.token or 'unknown'} | "
        f"candles={len(req.prices)} | "
        f"covariates={[c for c,v in [('rsi',req.rsi_history),('liquidity',req.liquidity_history),('volume',req.volume_history),('buy_pressure',req.buy_pressure)] if v]} | "
        f"prediction_length={req.prediction_length}"
    )
    # ─────────────────────────────────────────────────────

    try:
        context_df, covariates_used = _build_context_df(req)

        # predict_df returns columns: item_id, timestamp, mean, 0.1, 0.5, 0.9 ...
        pred_df = pipeline.predict_df(
            context_df,
            prediction_length=req.prediction_length,
            quantile_levels=[0.1, 0.5, 0.9],
            id_column="item_id",
            timestamp_column="timestamp",
            target="target",
        )

        rows = pred_df.sort_values("timestamp")
        forecasts = [
            QuantileForecast(
                low=float(row["0.1"]),
                median=float(row["0.5"]),
                high=float(row["0.9"]),
            )
            for _, row in rows.iterrows()
        ]

        current_price = req.prices[-1]
        pct_change = (forecasts[-1].median - current_price) / current_price

        # Tighter threshold than Bolt — Chronos-2 is more accurate
        direction = (
            "bullish"
            if pct_change > 0.01
            else "bearish"
            if pct_change < -0.01
            else "neutral"
        )

        avg_spread = float(
            np.mean(
                [
                    (f.high - f.low) / max(abs(current_price), 1e-12)
                    for f in forecasts
                ]
            )
        )
        confidence = round(float(max(0.0, min(1.0, 1.0 - avg_spread))), 3)

        cov_note = (
            f" (covariates: {', '.join(covariates_used)})"
            if covariates_used
            else " (univariate)"
        )
        summary = (
            f"Median {'+' if pct_change >= 0 else ''}{pct_change*100:.2f}% "
            f"over {req.prediction_length}×{req.candle_minutes}min{cov_note}. "
            f"Range ${forecasts[0].low:.8g}–${forecasts[-1].high:.8g}"
        )

        return ForecastResponse(
            token=req.token,
            current_price=current_price,
            forecasts=forecasts,
            direction=direction,
            confidence=confidence,
            pct_change=round(pct_change * 100, 4),
            covariates_used=covariates_used,
            summary=summary,
        )

    except Exception as e:
        logger.exception(f"Forecast error [{req.token}]: {e}")
        raise HTTPException(500, str(e))


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": "chronos-2-small",
        "model_loaded": pipeline is not None,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")