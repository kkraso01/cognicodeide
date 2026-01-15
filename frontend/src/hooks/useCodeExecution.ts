/**
 * Hook for code execution with enqueue + poll pattern.
 * 
 * Phase 1/2 compatible:
 * - POST /api/execute → 202 enqueue (fast)
 * - GET /api/execute/{run_id} → 200 poll (retrieve status + outputs)
 */
import { useState, useCallback, useRef } from 'react';
import { apiClientRaw } from '../utils/apiClient';

export interface ExecutionState {
  runId: number | null;
  status: 'idle' | 'queued' | 'running' | 'success' | 'error' | 'timeout' | 'compilation_error';
  stdout: string;
  stderr: string;
  buildOutput: {
    stdout: string;
    stderr: string;
    exit_code: number;
    execution_time: number;
  } | null;
  isPolling: boolean;
  totalTime: number | null;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

export interface ExecuteCodeParams {
  language: string;
  files: Array<{
    name: string;
    path: string;
    content: string;
    is_main?: boolean;
  }>;
  attempt_id: number;
  build_command?: string;
  run_command?: string;
  stdin?: string;
}

export interface ExecuteRunResponse {
  id: number;
  status: 'queued' | 'running' | 'success' | 'error' | 'timeout' | 'compilation_error';
  stdout: string;
  stderr: string;
  build_output: {
    stdout: string;
    stderr: string;
    exit_code: number;
    execution_time: number;
  } | null;
  total_time: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

const POLL_INTERVAL_MS = 500;
const MAX_POLL_ATTEMPTS = 600; // 5 minutes max

export function useCodeExecution() {
  const [state, setState] = useState<ExecutionState>({
    runId: null,
    status: 'idle',
    stdout: '',
    stderr: '',
    buildOutput: null,
    isPolling: false,
    totalTime: null,
    createdAt: null,
    startedAt: null,
    finishedAt: null,
    error: null,
  });

  const pollAttemptRef = useRef(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollAttemptRef.current = 0;
  }, []);

  const executeCode = useCallback(
    async (params: ExecuteCodeParams) => {
      try {
        // 1. Enqueue job (fast, 202)
        setState((s) => ({
          ...s,
          status: 'queued',
          stdout: '',
          stderr: '',
          buildOutput: null,
          error: null,
          isPolling: true,
        }));

        const enqueueRes = await apiClientRaw.post<{ run_id: number }>('/api/execute', params);
        const { run_id } = enqueueRes;

        setState((s) => ({
          ...s,
          runId: run_id,
          status: 'queued',
          error: null,
        }));

        // 2. Start polling
        pollAttemptRef.current = 0;
        clearPoll();

        pollIntervalRef.current = setInterval(async () => {
          pollAttemptRef.current += 1;

          // Safety: Stop polling after max attempts
          if (pollAttemptRef.current > MAX_POLL_ATTEMPTS) {
            clearPoll();
            setState((s) => ({
              ...s,
              status: 'error',
              stderr: 'Polling timeout: execution took too long',
              isPolling: false,
            }));
            return;
          }

          try {
            const pollRes = await apiClientRaw.get<ExecuteRunResponse>(`/api/execute/${run_id}`);
            const result = pollRes;

            // Update state with current result
            setState((s) => ({
              ...s,
              status: result.status as ExecutionState['status'],
              stdout: result.stdout || s.stdout,
              stderr: result.stderr || s.stderr,
              buildOutput: result.build_output || s.buildOutput,
              totalTime: result.total_time,
              createdAt: result.created_at,
              startedAt: result.started_at,
              finishedAt: result.finished_at,
            }));

            // Stop polling when terminal state reached
            const terminalStates = [
              'success',
              'error',
              'timeout',
              'compilation_error',
            ];
            if (terminalStates.includes(result.status)) {
              clearPoll();
              setState((s) => ({
                ...s,
                isPolling: false,
              }));
            }
          } catch (pollError: any) {
            // Network error during polling - retry
            if (pollError.response?.status === 404) {
              // Run not found
              clearPoll();
              setState((s) => ({
                ...s,
                status: 'error',
                stderr: 'Run not found',
                isPolling: false,
              }));
            } else if (pollError.response?.status === 403) {
              // Unauthorized
              clearPoll();
              setState((s) => ({
                ...s,
                status: 'error',
                stderr: 'Unauthorized',
                isPolling: false,
              }));
            }
            // Other errors: retry on next interval
          }
        }, POLL_INTERVAL_MS);
      } catch (enqueueError: any) {
        clearPoll();

        const statusCode = enqueueError.response?.status;
        const detail = enqueueError.response?.data?.detail;

        let errorMsg = 'Failed to enqueue execution';

        if (statusCode === 400) {
          errorMsg = `Invalid request: ${detail}`;
        } else if (statusCode === 403) {
          errorMsg = 'Unauthorized';
        } else if (statusCode === 409) {
          errorMsg = 'Run already in progress. Please wait.';
        } else if (statusCode === 429) {
          errorMsg = 'Too many runs. Please wait 2 seconds.';
        } else if (statusCode === 503) {
          errorMsg = 'Execution queue overloaded. Try again.';
        } else {
          errorMsg = detail || enqueueError.message;
        }

        setState((s) => ({
          ...s,
          status: 'error',
          stderr: errorMsg,
          isPolling: false,
          error: errorMsg,
        }));
      }
    },
    [clearPoll]
  );

  const reset = useCallback(() => {
    clearPoll();
    setState({
      runId: null,
      status: 'idle',
      stdout: '',
      stderr: '',
      buildOutput: null,
      isPolling: false,
      totalTime: null,
      createdAt: null,
      startedAt: null,
      finishedAt: null,
      error: null,
    });
  }, [clearPoll]);

  return {
    ...state,
    executeCode,
    reset,
  };
}
