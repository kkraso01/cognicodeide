/**
 * Code execution output panel.
 * Displays stdout, stderr, build output, and execution status.
 */
import React from 'react';
import './ExecutionOutput.css';

export interface ExecutionOutputProps {
  status: string;
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
  error: string | null;
}

export const ExecutionOutput: React.FC<ExecutionOutputProps> = ({
  status,
  stdout,
  stderr,
  buildOutput,
  isPolling,
  totalTime,
  error,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'idle':
        return 'text-gray-400';
      case 'queued':
      case 'running':
        return 'text-blue-500';
      case 'success':
        return 'text-green-500';
      case 'error':
      case 'timeout':
      case 'compilation_error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = () => {
    if (isPolling) return '⏳';
    switch (status) {
      case 'idle':
        return '';
      case 'queued':
        return '📍';
      case 'running':
        return '▶️';
      case 'success':
        return '✅';
      case 'error':
      case 'compilation_error':
        return '❌';
      case 'timeout':
        return '⏱️';
      default:
        return '?';
    }
  };

  const statusLabel = {
    idle: 'Ready',
    queued: 'Queued',
    running: 'Running',
    success: 'Success',
    error: 'Error',
    timeout: 'Timeout',
    compilation_error: 'Build Error',
  }[status] || status;

  return (
    <div className="execution-output">
      <div className="output-header">
        <div className={`status-badge ${getStatusColor()}`}>
          {getStatusIcon()} {statusLabel}
        </div>
        {totalTime !== null && (
          <div className="execution-time">
            ⏱️ {totalTime.toFixed(2)}s
          </div>
        )}
      </div>

      {/* Build Output */}
      {buildOutput && (
        <div className="output-section">
          <div className="section-title">Build Output</div>
          {buildOutput.exit_code === 0 ? (
            <div className="output-success">
              <pre>{buildOutput.stdout}</pre>
            </div>
          ) : (
            <div className="output-error">
              <pre>{buildOutput.stderr || buildOutput.stdout}</pre>
            </div>
          )}
          <div className="output-meta">
            Build time: {buildOutput.execution_time.toFixed(2)}s
          </div>
        </div>
      )}

      {/* Stdout */}
      {stdout && (
        <div className="output-section">
          <div className="section-title">Output</div>
          <div className="output-success">
            <pre>{stdout}</pre>
          </div>
        </div>
      )}

      {/* Stderr */}
      {stderr && status !== 'error' && (
        <div className="output-section">
          <div className="section-title">Error Output</div>
          <div className="output-error">
            <pre>{stderr}</pre>
          </div>
        </div>
      )}

      {/* Error Message (enqueue/poll errors) */}
      {error && (
        <div className="output-section">
          <div className="section-title">Error</div>
          <div className="output-error">
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {status === 'queued' && !stdout && (
        <div className="status-message">
          Waiting in queue... Your code will run shortly.
        </div>
      )}
      {status === 'running' && (
        <div className="status-message">
          Executing your code...
        </div>
      )}
      {status === 'timeout' && (
        <div className="status-message">
          Code execution timed out after 30 seconds.
        </div>
      )}
    </div>
  );
};
