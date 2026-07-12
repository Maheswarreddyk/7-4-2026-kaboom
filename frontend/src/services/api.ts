import axios from 'axios';
import { environment } from 'config';
import type { ReportReason, SessionData, StatsData } from '../types/index.js';
import { getBrowserInfo, retry } from '../utils/index.js';

const API_URL = environment.apiUrl;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (environment.nodeEnv === 'development') {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  }
  return config;
});

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.error ||
      (status === 404 ? `Endpoint not found: ${error.config?.url}` : null) ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new ApiError(message, status));
  }
);


export const apiService = {
  async getHealth(): Promise<{ status: string; database: string }> {
    const { data } = await api.get('/health');
    return data;
  },

  async getStats(): Promise<StatsData> {
    const { data } = await retry(async () => {
      const response = await api.get('/stats');
      return response;
    });
    return data.data;
  },

  async startSession(): Promise<SessionData> {
    const { browser, device, platform } = getBrowserInfo();

    const { data } = await retry(async () => {
      const response = await api.post('/start-session', {
        browser,
        device,
        platform,
      });
      return response;
    });

    return {
      sessionId: data.data.sessionId,
      sessionToken: data.data.sessionToken,
      createdAt: data.data.createdAt,
      status: data.data.status,
    };
  },

  async endSession(sessionId: string): Promise<void> {
    await api.post('/end-session', { sessionId });
  },

  async restoreSession(sessionId: string, sessionToken: string): Promise<SessionData> {
    const { data } = await api.post('/restore-session', { sessionId, sessionToken });
    return {
      sessionId: data.data.sessionId,
      sessionToken: data.data.sessionToken,
      createdAt: data.data.createdAt,
      status: data.data.status,
    };
  },

  async submitHeartbeat(sessionId: string, sessionToken: string): Promise<void> {
    await api.post('/session/heartbeat', { sessionId, sessionToken });
  },

  async submitReport(
    reporterSessionId: string,
    reportedSessionId: string,
    reason: ReportReason,
    notes?: string
  ): Promise<void> {
    await api.post('/report', {
      reporterSessionId,
      reportedSessionId,
      reason,
      notes,
    });
  },

  async submitFeedback(
    sessionId: string,
    rating: number,
    feedback?: string
  ): Promise<void> {
    await api.post('/feedback', { sessionId, rating, feedback });
  },

  async submitPreferences(
    sessionId: string,
    sessionToken: string,
    preferences: {
      gender?: string;
      looking_for?: string[];
      languages?: string[];
      country?: string;
      state?: string;
      district?: string;
      city?: string;
      interest_tags?: string[];
      display_name?: string;
      bio?: string;
      match_mode?: 'RANDOM' | 'PREFER' | 'STRICT';
      match_constraints?: Record<string, boolean>;
      match_attributes?: Record<string, string[]>;
    }
  ): Promise<void> {
    await api.post('/preferences', { sessionId, sessionToken, preferences });
  },

  async getLocations(query: string): Promise<any[]> {
    const { data } = await api.get(`/locations?q=${encodeURIComponent(query)}`);
    return data.data || [];
  },

  async getInterests(query: string): Promise<any[]> {
    const { data } = await api.get(`/interests?q=${encodeURIComponent(query)}`);
    return data.data || [];
  },

  async getUniversities(query: string): Promise<any[]> {
    const { data } = await api.get(`/universities?q=${encodeURIComponent(query)}`);
    return data.data || [];
  },

  async submitLike(
    sessionId: string,
    sessionToken: string,
    matchId: string
  ): Promise<{ success: boolean; mutual: boolean }> {
    const { data } = await api.post('/like', { sessionId, sessionToken, matchId });
    return data.data;
  },

  async submitChatMessage(
    sessionId: string,
    sessionToken: string,
    matchId: string,
    message: string
  ): Promise<any> {
    const { data } = await api.post('/chat', { sessionId, sessionToken, matchId, message });
    return data.data;
  },

  async getChatMessages(matchId: string): Promise<any[]> {
    const { data } = await api.get(`/chat/${matchId}`);
    return data.data || [];
  },

  async getAnalytics(adminToken: string): Promise<any> {
    const { data } = await api.get('/analytics', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    return data.data;
  },
};
