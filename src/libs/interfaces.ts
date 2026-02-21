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
  onAnalyze?: (token: WatchlistItem) => void;
}