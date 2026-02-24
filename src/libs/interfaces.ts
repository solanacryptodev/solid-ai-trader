import type { Accessor } from "solid-js";
import { ObjectId } from "mongodb";

export interface TokenData {
  address: string;
  symbol: string;
  name: string;
  price: number;
  logoUri: string;
  priceChange24h: number;
  liquidity: number;
  volume24h: number;
  marketCap: number;
  dexScreenerUrl: string;
  birdeyeUrl: string;
  holder: number;
  totalSupply: number;
}

export interface BirdeyeToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo_uri?: string;
  liquidity: number;
  price: number;
  price_24h_percent_change: number;
  volume_24h: number;
  market_cap?: number;
  holder: number;
  total_supply: number;
}

export interface BirdeyeResponse {
  success: boolean;
  data: {
    items: BirdeyeToken[];
    total_count: number;
  };
}

export interface TwitterData {
  tweet: string;
}

// Token shield warning interface
export interface TokenShieldWarning {
  type: string;
  message: string;
  severity: "info" | "warning" | "critical";
  source: string;
}

// Watchlist item interface
export interface WatchlistItem {
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

export interface WatchlistModalProps {
  token: WatchlistItem;
  onClose: () => void;
  onCopy: () => void;
  copied: boolean;
  shouldShowFallback: (id: string, icon: string) => boolean;
  handleImageError: (id: string) => void;
  onAnalyze?: ((token: WatchlistItem) => void) | Accessor<((token: WatchlistItem) => void) | undefined>;
}

// Potential token type - tokens selected from Watchlist for further analysis
export interface PotentialToken {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  address: string;
}

// ── Price Store Types ────────────────────────────────────────────────────────

export interface PriceSample {
  price: number;
  timestamp: number;
  liquidity?: number;
  priceChange24h?: number;
}

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number; // candle open time
}

export type SmoothingType = "EMA" | "SMA";

export interface RSIResult {
  rsi: number;
  signal: "oversold" | "overbought" | "neutral";
  smoothingLine: number | null;
  crossover: "above_signal" | "below_signal" | null;
  length: number;
  smoothingLength: number;
  smoothingType: SmoothingType;
  insufficientData: boolean;
  samplesHave: number;
  samplesNeed: number;
}

export interface QuantileForecast {
  low: number;
  median: number;
  high: number;
}

export interface ChronosForecastResponse {
  token: string | null;
  current_price: number;
  forecasts: QuantileForecast[];
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
  pct_change: number;       // median % change vs current price
  covariates_used: string[]; // which covariates Chronos-2 received
  summary: string;
}

export interface ChronosInput {
  prices: number[];
  rsi_history?: number[];       // past covariate
  liquidity_history?: number[]; // past covariate
  volume_history?: number[];    // past covariate
  buy_pressure?: number[];      // past covariate
  prediction_length?: number;
  token?: string;
}

export interface TokenState {
  mintAddress: string;
  label?: string;
  samples: PriceSample[];
  candles: Candle[];
  currentCandle: Partial<Candle> & { open?: number; high?: number; low?: number };
  candleOpenTime: number;
  /**
   * Rolling liquidity history aligned with candle closes.
   * Persisted on state so we don't have to re-derive it from samples every tick.
   */
  liquidityHistory: number[];
  rsi: RSIResult | null;
  forecast: ChronosForecastResponse | null;
  lastUpdated: number;
  /**
   * Human-readable warmup status for the dashboard.
   * Examples: "building 8/18", "warming 22/25", "ready"
   */
  signalStatus: string;
}

// ── MongoDB Trade Record ─────────────────────────────────────────────────────

export interface TradeRecord {
  _id?: ObjectId;

  // Identity
  token: string;       // human label e.g. "MENCHO"
  mintAddress: string;       // Solana mint
  timestamp: Date;         // entry time

  // Entry conditions — what triggered the trade
  entryPrice: number;
  entryRSI: number;
  entryDirection: "bullish" | "bearish" | "neutral";
  entryConfidence: number;       // 0-1
  entrySignal: string;       // e.g. "oversold_bullish"
  volumeAtEntry: number;       // USD liquidity at entry
  candleCount: number;       // token maturity at entry
  isLowVolume: boolean;      // flagged as low volume trade

  // Exit conditions — populated when trade closes
  exitPrice?: number;
  exitTime?: Date;
  exitReason?: "chronos_bearish" | "rsi_overbought" | "time_limit" | "stop_loss" | "manual";
  holdMinutes?: number;

  // Outcome — populated when trade closes
  pnlPct?: number;       // % gain/loss
  profitable?: boolean;

  // Devnet vs mainnet
  network: "devnet" | "mainnet";
}

// ── MongoDB Signal Record ────────────────────────────────────────────────────

export interface SignalRecord {
  _id?: ObjectId;
  timestamp: Date;
  token: string;
  mintAddress: string;

  // Signal details
  signal: "BUY" | "SELL" | "WAIT";
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;       // 0-1
  rsi: number;
  rsiSignal: "oversold" | "overbought" | "neutral";
  candleCount: number;

  // Was this signal acted on?
  tradeEntered: boolean;
  skipReason?: string;       // why we didn't trade e.g. "low_confidence"
}

// ── MongoDB Forecast Record ──────────────────────────────────────────────────

export interface ForecastRecord {
  _id?: ObjectId;
  timestamp: Date;
  token: string;
  mintAddress: string;

  // Chronos output
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
  pctChange: number;
  covariatesUsed: string[];

  // Quantile forecasts
  forecasts: {
    low: number;
    median: number;
    high: number;
  }[];

  // Actual outcome — filled in retrospectively
  actualPrices?: number[];     // what price actually did
  accurate?: boolean;      // did direction call match?
}

// ── MongoDB Performance Summary ──────────────────────────────────────────────

export interface PerformanceSummary {
  totalTrades: number;
  winRate: number;   // 0-1
  avgWinPct: number;
  avgLossPct: number;
  avgHoldMinutes: number;
  avgEntryConfidence: number;
  bestTrade: number;
  worstTrade: number;

  // Breakdowns the agent uses for rule tuning
  lowVolumeWinRate: number;
  highConfWinRate: number;   // confidence > 0.85
  byExitReason: {
    [reason: string]: { count: number; avgPnl: number };
  };
}
