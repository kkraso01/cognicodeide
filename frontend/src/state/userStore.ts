import { create } from 'zustand';
import { api } from '../utils/apiClient';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'Student' | 'Teacher';
}

interface UserState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, role: 'Student' | 'Teacher') => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.login({ username, password });
      const token = response.access_token;
      localStorage.setItem('token', token);
      
      // Fetch user info
      const user = await api.getMe();
      set({ token, user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || 'Login failed', 
        isLoading: false 
      });
      throw error;
    }
  },

  register: async (username: string, email: string, password: string, role: 'Student' | 'Teacher') => {
    set({ isLoading: true, error: null });
    try {
      await api.register({ username, email, password, role });
      // Auto-login after registration
      await useUserStore.getState().login(username, password);
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || 'Registration failed', 
        isLoading: false 
      });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
    api.logout().catch(() => {});
  },

  fetchUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      return;
    }
    
    set({ isLoading: true });
    try {
      const user = await api.getMe();
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: 'Session expired' });
    }
  },
}));
