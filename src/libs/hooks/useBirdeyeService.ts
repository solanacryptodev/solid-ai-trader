// lib/hooks/useBirdeyeTokens.ts
import { createSignal, createResource } from 'solid-js';
import { birdeyeService } from '../../services/birdeye';
import { TokenData } from '../interfaces';

export function useBirdeyeTokens() {
  const [tokens, setTokens] = createSignal<TokenData[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [endPointUrl, setEndpointUrl] = createSignal<string>('');

  const fetchTokens = async (limit: number = 50) => {
    setIsLoading(true);
    setError(null);
    // This will have to come from the AI in the future as part of the agentic workflow.FetchTokens will not just take the limit
    // but also the endpointUrl
    setEndpointUrl(`/defi/tokenlist?sort_by=liquidity&sort_type=desc&offset=0&limit=${limit}&min_liquidity=10000&ui_amount_mode=scaled`)
    
    try {
      const tokenData = await birdeyeService.fetchTopTokensByLiquidity(endPointUrl());
      setTokens(tokenData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Failed to fetch tokens:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    tokens,
    isLoading,
    error,
    fetchTokens,
    refetch: () => fetchTokens()
  };
}