import type { Accessor } from "solid-js";

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
  severity: 'info' | 'warning' | 'critical';
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
  timestamp: number;
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
  pct_change: number;
  covariates_used: string[];
  summary: string;
}

export interface TokenState {
  mintAddress: string;
  samples: PriceSample[];
  candles: Candle[];
  currentCandle: Partial<Candle> & { open?: number; high?: number; low?: number };
  candleOpenTime: number;
  rsi: RSIResult | null;
  forecast: ChronosForecastResponse | null;
  lastUpdated: number;
  label?: string;
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
  pct_change: number; // median % change vs current price
  covariates_used: string[]; // which covariates Chronos-2 received
  summary: string;
}

export interface ChronosInput {
  prices: number[];
  rsi_history?: number[]; // past covariate
  liquidity_history?: number[]; // past covariate
  volume_history?: number[]; // past covariate
  buy_pressure?: number[]; // past covariate
  prediction_length?: number;
  token?: string;
}

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

export interface TokenState {
  mintAddress: string;
  samples: PriceSample[];
  candles: Candle[];
  currentCandle: Partial<Candle> & { open?: number; high?: number; low?: number };
  candleOpenTime: number;
  rsi: RSIResult | null;
  forecast: ChronosForecastResponse | null;
  lastUpdated: number;
  label?: string;
}
