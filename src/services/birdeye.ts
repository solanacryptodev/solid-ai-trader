'use server'

import { TokenData, BirdeyeToken, BirdeyeResponse } from '../libs/interfaces';

export class BirdeyeService {
  private baseUrl = 'https://public-api.birdeye.so';
  private endPointUrl = '';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchTopTokensByLiquidity(endPoint: string): Promise<TokenData[]> {
    try {
      const options = {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': this.apiKey
        }
      };

      this.endPointUrl = endPoint;

      if (this.endPointUrl.length == 0) {
        throw new Error(`Issue with endpoint URL. Length of 0.`);
      }

      const url = `${this.baseUrl}${this.endPointUrl}`;
      console.log('url: ', url)
      const response = await fetch(url, options);
      console.log('birdeye data', response.json())
      
      if (!response.ok) {
        throw new Error(`Birdeye API error: ${response.status} ${response.statusText}`);
      }

      const data: BirdeyeResponse = await response.json();
      
      if (!data.success) {
        throw new Error('Birdeye API returned unsuccessful response');
      }

      return this.transformBirdeyeTokens(data.data.items);
      
    } catch (error) {
      console.error('Error fetching tokens from Birdeye:', error);
      throw error;
    }
  }

  async fetchTokenDetails(tokenAddress: string): Promise<TokenData | null> {
    try {
      const options = {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': this.apiKey
        }
      };

      const url = `${this.baseUrl}/defi/v3/token/detail?address=${tokenAddress}`;
      
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`Birdeye API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Birdeye API returned unsuccessful response');
      }

      return this.transformBirdeyeToken(data.data);
      
    } catch (error) {
      console.error(`Error fetching token details for ${tokenAddress}:`, error);
      return null;
    }
  }

  private transformBirdeyeTokens(birdeyeTokens: BirdeyeToken[]): TokenData[] {
    return birdeyeTokens.map(token => this.transformBirdeyeToken(token));
  }

  private transformBirdeyeToken(birdeyeToken: BirdeyeToken): TokenData {
    return {
      address: birdeyeToken.address,
      symbol: birdeyeToken.symbol,
      name: birdeyeToken.name,
      price: birdeyeToken.price || 0,
      priceChange24h: birdeyeToken.price_24h_percent_change || 0,
      liquidity: birdeyeToken.liquidity || 0,
      volume24h: birdeyeToken.volume_24h || 0,
      marketCap: birdeyeToken.market_cap || 0,
      holder: birdeyeToken.holder || 0,
      totalSupply: birdeyeToken.total_supply || 0,
      logoUri: '',
      dexScreenerUrl: `https://dexscreener.com/solana/${birdeyeToken.address}`,
      birdeyeUrl: `https://birdeye.so/token/${birdeyeToken.address}?chain=solana`
    };
  }

  // Additional utility method to fetch multiple token details in parallel
  async fetchMultipleTokenDetails(addresses: string[]): Promise<TokenData[]> {
    const promises = addresses.map(address => this.fetchTokenDetails(address));
    const results = await Promise.all(promises);
    return results.filter((token): token is TokenData => token !== null);
  }
}

// Singleton instance with environment configuration
export const birdeyeService = new BirdeyeService(
  import.meta.env.VITE_BIRDEYE_API_KEY || ''
);