/**
 * Currency Service
 * Handles currency conversion with caching and fallback mechanisms
 */

import { GBP_TO_INR_RATE } from '../constants';

export interface ExchangeRateData {
  rate: number;
  lastUpdated: Date;
  source: 'api' | 'cache' | 'fallback';
}

export interface CurrencyConversionResult {
  gbp: number;
  inr: number;
  exchangeRate: number;
  lastUpdated: Date;
  source: string;
}

class CurrencyService {
  private static instance: CurrencyService;
  private cachedRate: ExchangeRateData | null = null;
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
  private readonly API_TIMEOUT = 5000; // 5 seconds
  private isUpdating = false;

  private constructor() {}

  static getInstance(): CurrencyService {
    if (!CurrencyService.instance) {
      CurrencyService.instance = new CurrencyService();
    }
    return CurrencyService.instance;
  }

  /**
   * Gets the current exchange rate with caching
   * @param forceRefresh Force refresh from API
   * @returns Exchange rate data
   */
  async getExchangeRate(forceRefresh = false): Promise<ExchangeRateData> {
    // Return cached rate if valid and not forcing refresh
    if (!forceRefresh && this.isCacheValid()) {
      return this.cachedRate!;
    }

    // Prevent multiple simultaneous API calls
    if (this.isUpdating) {
      return this.waitForUpdate();
    }

    this.isUpdating = true;

    try {
      const apiRate = await this.fetchFromAPI();
      this.cachedRate = {
        rate: apiRate,
        lastUpdated: new Date(),
        source: 'api'
      };
      return this.cachedRate;
    } catch (error) {
      console.warn('Failed to fetch exchange rate from API:', error);
      
      // Return cached rate if available, even if expired
      if (this.cachedRate) {
        return {
          ...this.cachedRate,
          source: 'cache'
        };
      }
      
      // Fallback to constant rate
      return {
        rate: GBP_TO_INR_RATE,
        lastUpdated: new Date(),
        source: 'fallback'
      };
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Converts GBP to INR using current exchange rate
   * @param gbpAmount Amount in GBP
   * @param useRealTime Whether to use real-time rate or cached
   * @returns Conversion result
   */
  async convertGbpToInr(gbpAmount: number, useRealTime = false): Promise<CurrencyConversionResult> {
    const exchangeData = await this.getExchangeRate(useRealTime);
    const inrAmount = gbpAmount * exchangeData.rate;

    return {
      gbp: Math.round(gbpAmount * 100) / 100,
      inr: Math.round(inrAmount * 100) / 100,
      exchangeRate: exchangeData.rate,
      lastUpdated: exchangeData.lastUpdated,
      source: exchangeData.source
    };
  }

  /**
   * Formats currency amount for display
   * @param amount Amount to format
   * @param currency Currency code ('GBP' or 'INR')
   * @returns Formatted currency string
   */
  formatCurrency(amount: number, currency: 'GBP' | 'INR'): string {
    if (currency === 'GBP') {
      return `£${amount.toFixed(2)}`;
    } else {
      return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    }
  }

  /**
   * Gets exchange rate status for display
   * @returns Status information
   */
  async getExchangeRateStatus(): Promise<{
    rate: number;
    lastUpdated: string;
    source: string;
    isStale: boolean;
  }> {
    const exchangeData = await this.getExchangeRate();
    const isStale = !this.isCacheValid();

    return {
      rate: exchangeData.rate,
      lastUpdated: exchangeData.lastUpdated.toLocaleString(),
      source: exchangeData.source,
      isStale
    };
  }

  /**
   * Preloads exchange rate in background
   */
  async preloadExchangeRate(): Promise<void> {
    try {
      await this.getExchangeRate();
    } catch (error) {
      console.warn('Failed to preload exchange rate:', error);
    }
  }

  /**
   * Clears cached exchange rate
   */
  clearCache(): void {
    this.cachedRate = null;
  }

  private isCacheValid(): boolean {
    if (!this.cachedRate) return false;
    
    const now = new Date().getTime();
    const cacheTime = this.cachedRate.lastUpdated.getTime();
    return (now - cacheTime) < this.CACHE_DURATION;
  }

  private async waitForUpdate(): Promise<ExchangeRateData> {
    return new Promise((resolve) => {
      const checkUpdate = () => {
        if (!this.isUpdating) {
          resolve(this.cachedRate || {
            rate: GBP_TO_INR_RATE,
            lastUpdated: new Date(),
            source: 'fallback'
          });
        } else {
          setTimeout(checkUpdate, 100);
        }
      };
      checkUpdate();
    });
  }

  private async fetchFromAPI(): Promise<number> {
    // TODO: Replace with actual API endpoint
    // For now, simulate API call with slight variation from constant rate
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate API response with small random variation
        const variation = (Math.random() - 0.5) * 2; // ±1 INR variation
        const simulatedRate = GBP_TO_INR_RATE + variation;
        resolve(Math.round(simulatedRate * 100) / 100);
      }, 1000);
    });

    /* 
    // Example implementation for real API:
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);

    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/GBP', {
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.rates.INR;
    } finally {
      clearTimeout(timeoutId);
    }
    */
  }
}

// Export singleton instance
export const currencyService = CurrencyService.getInstance();

// Export utility functions
export const getExchangeRate = () => currencyService.getExchangeRate();
export const convertGbpToInr = (amount: number) => currencyService.convertGbpToInr(amount);
export const formatCurrency = (amount: number, currency: 'GBP' | 'INR') => 
  currencyService.formatCurrency(amount, currency);