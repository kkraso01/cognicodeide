import { create } from 'zustand';
import { api } from '../utils/apiClient';

interface Assignment {
  id: number;
  title: string;
  description: string;
  language: string;
  ai_mode: string;
  starter_code?: string;
  test_cases?: string;
  support_files?: string; // JSON string of support files
  version_hash?: string;
  created_at: string;
  build_command?: string; // Custom build command
  run_command?: string;   // Custom run command
}

interface AssignmentState {
  assignments: Assignment[];
  currentAssignment: Assignment | null;
  isLoading: boolean;
  error: string | null;
  fetchAssignments: () => Promise<void>;
  fetchAssignment: (id: number) => Promise<void>;
  createAssignment: (data: any) => Promise<void>;
  updateAssignment: (id: number, data: any) => Promise<void>;
  deleteAssignment: (id: number) => Promise<void>;
}

export const useAssignmentStore = create<AssignmentState>((set) => ({
  assignments: [],
  currentAssignment: null,
  isLoading: false,
  error: null,

  fetchAssignments: async () => {
    set({ isLoading: true, error: null });
    try {
      const assignments = await api.getAssignments();
      set({ assignments, isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || 'Failed to fetch assignments', 
        isLoading: false 
      });
    }
  },

  fetchAssignment: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      const assignment = await api.getAssignment(id);
      set({ currentAssignment: assignment, isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || 'Failed to fetch assignment', 
        isLoading: false 
      });
    }
  },

  createAssignment: async (data: any) => {
    set({ isLoading: true, error: null });
    try {
      await api.createAssignment(data);
      await useAssignmentStore.getState().fetchAssignments();
      set({ isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || 'Failed to create assignment', 
        isLoading: false 
      });
      throw error;
    }
  },

  updateAssignment: async (id: number, data: any) => {
    set({ isLoading: true, error: null });
    try {
      await api.updateAssignment(id, data);
      await useAssignmentStore.getState().fetchAssignments();
      set({ isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || 'Failed to update assignment', 
        isLoading: false 
      });
      throw error;
    }
  },

  deleteAssignment: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteAssignment(id);
      set((state) => ({
        assignments: state.assignments.filter((a) => a.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || 'Failed to delete assignment', 
        isLoading: false 
      });
      throw error;
    }
  },
}));
