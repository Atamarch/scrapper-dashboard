/**
 * API client for crawler backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type Schedule = {
  id: string;
  name: string;
  start_schedule: string;
  status: 'active' | 'inactive';
  last_run: string | null;
  created_at: string;
};

export type ScheduleCreate = {
  name: string;
  start_schedule: string;
  status?: 'active' | 'inactive';
};

export type ScheduleUpdate = {
  name?: string;
  start_schedule?: string;
  status?: 'active' | 'inactive';
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
}

export const crawlerAPI = new CrawlerAPI();
