import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { API_BASE_URL } from './constants';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();

// API endpoints
export const api = {
  // Auth
  register: (data: any) => apiClient.post('/api/auth/register', data),
  login: (data: any) => apiClient.post<{ access_token: string; token_type: string }>('/api/auth/login', data),
  getMe: () => apiClient.get<any>('/api/auth/me'),
  logout: () => apiClient.post('/api/auth/logout'),
  getStudents: () => apiClient.get<any[]>('/api/auth/students'),

  // Assignments
  getAssignments: () => apiClient.get<any[]>('/api/assignments'),
  getAssignment: (id: number) => apiClient.get<any>(`/api/assignments/${id}`),
  createAssignment: (data: any) => apiClient.post('/api/assignments', data),
  updateAssignment: (id: number, data: any) => apiClient.put(`/api/assignments/${id}`, data),
  deleteAssignment: (id: number) => apiClient.delete(`/api/assignments/${id}`),

  // Attempts
  createAttempt: (data: any) => apiClient.post<any>('/api/attempts', data),
  getAttempts: (assignmentId?: number) => 
    apiClient.get<any[]>(`/api/attempts${assignmentId ? `?assignment_id=${assignmentId}` : ''}`),
  getAttempt: (id: number) => apiClient.get<any>(`/api/attempts/${id}`),
  getLatestAttempt: (assignmentId: number) => 
    apiClient.get<any>(`/api/attempts/latest/${assignmentId}`),
  finishAttempt: (id: number, finalCode?: string) => 
    apiClient.put(`/api/attempts/${id}/finish`, { final_code: finalCode }),
  saveAttempt: (id: number, codeData: any) => 
    apiClient.put(`/api/attempts/${id}/save`, codeData),

  // Events
  logEvents: (data: any) => apiClient.post('/api/events', data),
  getEvents: (attemptId: number) => apiClient.get<any[]>(`/api/events/${attemptId}`),

  // AI
  chat: (data: any, attemptId?: number) => 
    apiClient.post<any>(`/api/ai/chat${attemptId ? `?attempt_id=${attemptId}` : ''}`, data),
  getAIInteractions: (attemptId: number) => 
    apiClient.get<any[]>(`/api/ai/interactions/${attemptId}`),
  leadAndReveal: (problem: string, attemptId: number, model?: string) =>
    apiClient.post<any>('/api/ai/lead-and-reveal', { 
      problem, 
      attempt_id: attemptId, 
      model: model || 'mistral' 
    }),
  traceAndPredict: (code: string, attemptId: number, model?: string) =>
    apiClient.post<any>('/api/ai/trace-and-predict', { 
      code, 
      attempt_id: attemptId, 
      model: model || 'mistral' 
    }),
  parsonsProblem: (problem: string, attemptId: number, model?: string) =>
    apiClient.post<any>('/api/ai/parsons', { 
      problem, 
      attempt_id: attemptId, 
      model: model || 'mistral' 
    }),

  // Replay
  getReplay: (attemptId: number) => apiClient.get<any>(`/api/replay/${attemptId}`),
  getReplayMetrics: (attemptId: number) => apiClient.get<any>(`/api/replay/${attemptId}/metrics`),
  getStudentAttempts: (studentId: number) => 
    apiClient.get<any>(`/api/events/attempts/student/${studentId}`),

  // Code execution
  executeCode: (data: { 
    language: string; 
    code?: string; 
    files?: Array<{ name: string; content: string; is_main?: boolean }>;
    build_command?: string;
    run_command?: string;
    input_data?: string;
  }) => apiClient.post<any>('/api/execute', data),

  // Task Orchestration
  getNextTask: (assignmentId: number) =>
    apiClient.post<any>('/api/tasks/next', null, {
      params: { assignment_id: assignmentId }
    }),
  requestHint: (attemptId: number) =>
    apiClient.post<any>('/api/tasks/hint', null, {
      params: { attempt_id: attemptId }
    }),
  submitTask: (data: any) =>
    apiClient.post('/api/tasks/submit', data),
  getTaskStats: (assignmentId: number) =>
    apiClient.get<any>(`/api/tasks/stats/${assignmentId}`),
};
