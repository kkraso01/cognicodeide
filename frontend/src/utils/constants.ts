export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// AI API Configuration
export const AI_API_URL = import.meta.env.VITE_AI_API_URL || 'https://194.42.17.230/api/send_message';
export const AI_MODEL = import.meta.env.VITE_AI_MODEL || 'mistral:latest';

export const SUPPORTED_LANGUAGES = ['python', 'c', 'java'] as const;
export type Language = typeof SUPPORTED_LANGUAGES[number];

export const AI_MODES = {
  NONE: 'none',
  LEAD_AND_REVEAL: 'lead-and-reveal',
  TRACE_AND_PREDICT: 'trace-and-predict',
  PARSONS: 'parsons',
  FULL_ACCESS: 'full-access',
} as const;

export const USER_ROLES = {
  STUDENT: 'Student',
  TEACHER: 'Teacher',
} as const;

export const EVENT_TYPES = {
  EDIT: 'edit',
  CURSOR: 'cursor',
  PASTE: 'paste',
  RUN: 'run',
  AI_PROMPT: 'ai_prompt',
  AI_RESPONSE: 'ai_response',
  FILE_CREATE: 'file_create',
  FILE_DELETE: 'file_delete',
  FILE_SWITCH: 'file_switch',
  // Friction engagement events
  HINT_REQUESTED: 'hint_requested',
  HINT_RECEIVED: 'hint_received',
  TECHNIQUE_TRANSITION: 'technique_transition',
  PARSONS_DRAG: 'parsons_drag',
  PARSONS_DROP: 'parsons_drop',
  ANSWER_SUBMITTED: 'answer_submitted',
  ANSWER_FEEDBACK: 'answer_feedback',
} as const;

export const BATCH_INTERVAL = 5000; // 5 seconds
export const IDLE_THRESHOLD = 30000; // 30 seconds
export const LARGE_PASTE_THRESHOLD = 100; // characters
export const MAX_EVENTS_IN_MEMORY = 1000; // Maximum events to keep in memory
// REMOVED: EDIT_THROTTLE_MS (replaced with debouncing in useSessionLogger)
