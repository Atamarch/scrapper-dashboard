/**
 * API client for crawler backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
export type ScrapingRequest = {
  template_id: string;
};

export type ScrapingResponse = {
  success: boolean;
  message: string;
  leads_queued: number;
  batch_id: string;
};

export type Schedule = {
  id: string;
  name: string;
  start_schedule: string;
  template_id: string;
  status: 'active' | 'inactive';
  last_run?: string | null;
  created_at: string;
};

export type ScheduleCreate = {
  name: string;
  start_schedule: string;
  template_id: string;
  status: 'active' | 'inactive';
};

export type ScheduleUpdate = {
  name: string;
  start_schedule: string;
  template_id: string;
  status: 'active' | 'inactive';
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
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error or unknown error occurred');
    }
  }

  // ===== CORE SYSTEM =====
  async healthCheck() {
    return this.request<{ status: string; timestamp: string }>('/health');
  }

  async getQueueStatus() {
    return this.request<any>('/api/schedules/queue/status');
  }

  // ===== REQUIREMENTS TEMPLATES =====
  async getTemplates() {
    return this.request<any>('/api/requirements/templates');
  }

  // ===== SCHEDULER MANAGEMENT =====
  async getSchedules() {
    return this.request<{ schedules: Schedule[] }>('/api/schedules');
  }

  async getSchedule(scheduleId: string) {
    return this.request<Schedule>(`/api/schedules/${scheduleId}`);
  }

  async createSchedule(data: ScheduleCreate) {
    return this.request<Schedule>('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSchedule(scheduleId: string, data: ScheduleUpdate) {
    return this.request<Schedule>(`/api/schedules/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSchedule(scheduleId: string) {
    return this.request<{ message: string }>(`/api/schedules/${scheduleId}`, {
      method: 'DELETE',
    });
  }

  async toggleSchedule(scheduleId: string) {
    return this.request<Schedule>(`/api/schedules/${scheduleId}/toggle`, {
      method: 'PATCH',
    });
  }

  async executeScheduleManually(scheduleId: string) {
    return this.request<any>(`/api/schedules/${scheduleId}/execute`, {
      method: 'POST',
    });
  }

  // ===== SCRAPING OPERATIONS =====
  async startScraping(data: ScrapingRequest) {
    return this.request<ScrapingResponse>('/api/scraping/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async analyzeLead(templateId: string) {
    return this.request<{
      total: number;
      complete: number;
      needProcessing: number;
      completionRate: number;
    }>(`/api/scraping/analyze/${templateId}`);
  }

  // ===== COMPANY MANAGEMENT =====
  async getCompanies(platform?: string) {
    const params = platform ? `?platform=${encodeURIComponent(platform)}` : '';
    return this.request<any>(`/api/companies${params}`);
  }

  // ===== LEADS MANAGEMENT =====
  async getLeadsByPlatform(platform: string, limit = 100, offset = 0) {
    return this.request<any>(`/api/leads/by-platform?platform=${encodeURIComponent(platform)}&limit=${limit}&offset=${offset}`);
  }

  // ===== OUTREACH OPERATIONS =====
  async sendOutreach(data: any) {
    return this.request<any>('/api/outreach/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const crawlerAPI = new CrawlerAPI();
