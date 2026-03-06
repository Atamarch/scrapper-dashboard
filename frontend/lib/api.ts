/**
 * API client for crawler backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type ScrapingRequest = {
  template_id: string;
};

export type ScrapingResponse = {
  success: boolean;
  message: string;
  leads_queued: number;
  batch_id: string;
};

class CrawlerAPI {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Core
  async healthCheck() {
    return this.request<{ status: string; timestamp: string }>('/health');
  }

  async getQueueStatus() {
    return this.request<any>('/api/queue/status');
  }

  // Scraping
  async startScraping(data: ScrapingRequest) {
    return this.request<ScrapingResponse>('/api/scraping/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Companies
  async getCompanies(platform?: string) {
    const params = platform ? `?platform=${encodeURIComponent(platform)}` : '';
    return this.request<any>(`/api/companies${params}`);
  }

  // Leads
  async getLeadsByPlatform(platform: string, limit = 100, offset = 0) {
    return this.request<any>(`/api/leads/by-platform?platform=${encodeURIComponent(platform)}&limit=${limit}&offset=${offset}`);
  }

  // Outreach
  async sendOutreach(data: any) {
    return this.request<any>('/api/outreach/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const crawlerAPI = new CrawlerAPI();
