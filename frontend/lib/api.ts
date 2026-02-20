/**
 * API client for crawler backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type Schedule = {
  id: string;
  name: string;
  start_schedule: string;
  stop_schedule: string | null;
  status: 'active' | 'paused';
  profile_urls: string[];
  max_workers: number;
  last_run: string | null;
  next_run: string | null;
  created_at: string;
  updated_at: string;
};

export type ScheduleCreate = {
  name: string;
  start_schedule: string;
  stop_schedule?: string;
  profile_urls?: string[];
  max_workers?: number;
  file_id?: string;
  file_name?: string;
  requirement_id?: string;
};

export type ScheduleUpdate = {
  name?: string;
  start_schedule?: string;
  stop_schedule?: string;
  status?: 'active' | 'paused';
  profile_urls?: string[];
  max_workers?: number;
};

export type CrawlRequest = {
  profile_urls: string[];
  max_workers?: number;
};

export type Stats = {
  total_schedules: number;
  active_schedules: number;
  paused_schedules: number;
  total_crawls: number;
  successful_crawls: number;
  failed_crawls: number;
  success_rate: number;
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

  // Health check
  async healthCheck() {
    return this.request<{ status: string; scheduler_running: boolean; timestamp: string }>('/api/health');
  }

  // Schedules
  async getSchedules() {
    return this.request<{ schedules: Schedule[] }>('/api/schedules');
  }

  async getSchedule(id: string) {
    return this.request<Schedule>(`/api/schedules/${id}`);
  }

  async createSchedule(data: ScheduleCreate) {
    return this.request<{ message: string; schedule_id: string }>('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSchedule(id: string, data: ScheduleUpdate) {
    return this.request<{ message: string }>(`/api/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSchedule(id: string) {
    return this.request<{ message: string }>(`/api/schedules/${id}`, {
      method: 'DELETE',
    });
  }

  async toggleSchedule(id: string) {
    return this.request<{ message: string; status: string }>(`/api/schedules/${id}/toggle`, {
      method: 'POST',
    });
  }

  // Manual crawl
  async manualCrawl(data: CrawlRequest) {
    return this.request<{ message: string; profile_count: number; max_workers: number }>('/api/crawl', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Statistics
  async getStats() {
    return this.request<Stats>('/api/stats');
  }
}

export const crawlerAPI = new CrawlerAPI();
