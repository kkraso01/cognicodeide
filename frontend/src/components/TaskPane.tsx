import React from 'react';

interface TaskPaneProps {
  assignment: any;
  onRun: () => void;
  onSubmit: () => void;
  onSave: () => void;
  onReset: () => void;
  output: string;
  isRunning: boolean;
}

export const TaskPane: React.FC<TaskPaneProps> = ({
  assignment,
  onRun,
  onSubmit,
  onSave,
  onReset,
  output,
  isRunning,
}) => {
  if (!assignment) {
    return <div className="empty-state-message">No assignment selected</div>;
  }

  return (
    <div className="task-container">
      <div className="task-header">
        <h2 className="task-title">{assignment.title}</h2>
        <div className="task-badges">
          <span className="task-badge">{assignment.language}</span>
          <span className="task-badge">{assignment.ai_mode}</span>
        </div>
      </div>

      <div className="task-description">
        <h3>Description</h3>
        <p>{assignment.description}</p>
      </div>

      <div className="task-actions">
        <button
          onClick={onRun}
          disabled={isRunning}
          className="task-btn task-btn-run"
          title="Run code (Ctrl+Enter)"
        >
          {isRunning ? 'Running...' : '▶ Run'}
        </button>
        
        <button 
          onClick={onSave} 
          className="task-btn btn-secondary"
          title="Save progress"
        >
          💾 Save
        </button>
        
        <button 
          onClick={onReset} 
          className="task-btn btn-secondary"
          title="Reset to starter code"
          style={{ borderColor: '#8a1c1c', color: '#ff8a80' }}
        >
          ↻ Reset
        </button>

        <button
          onClick={onSubmit}
          className="task-btn task-btn-submit"
          title="Submit assignment"
        >
           ✅ Submit
        </button>
      </div>

      {output && (
        <div className="task-output">
          <div className="task-output-header">Output</div>
          <pre className="task-output-content">{output}</pre>
        </div>
      )}
    </div>
  );
};


