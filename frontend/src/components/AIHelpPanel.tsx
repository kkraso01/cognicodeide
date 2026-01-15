import React, { useState } from 'react';
import { useAIInteraction } from '../hooks/useAIInteraction';
import { LeadAndRevealPanel } from './LeadAndRevealPanel';
import { TraceAndPredictPanel } from './TraceAndPredictPanel';
import { ParsonsPanel } from './ParsonsPanel';

interface AIHelpPanelProps {
  attemptId: number | null;
  aiMode: string;
  onAIPrompt?: (prompt: string) => void;
  onAIResponse?: (response: string) => void;
  onCodeGenerated?: (code: string) => void;
}

export const AIHelpPanel: React.FC<AIHelpPanelProps> = ({
  attemptId,
  aiMode,
  onAIPrompt,
  onAIResponse,
  onCodeGenerated,
}) => {
  const [reasoning, setReasoning] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { messages, isLoading, error, sendMessage } = useAIInteraction(attemptId);

  if (aiMode === 'none') {
    return null;
  }

  // Route to specialized panels based on AI mode
  if (aiMode === 'lead-and-reveal') {
    return (
      <LeadAndRevealPanel
        attemptId={attemptId}
        onAIPrompt={onAIPrompt}
        onAIResponse={onAIResponse}
      />
    );
  }

  if (aiMode === 'trace-and-predict') {
    return (
      <TraceAndPredictPanel
        attemptId={attemptId}
        onAIPrompt={onAIPrompt}
        onAIResponse={onAIResponse}
      />
    );
  }

  if (aiMode === 'parsons') {
    return (
      <ParsonsPanel
        attemptId={attemptId}
        onAIPrompt={onAIPrompt}
        onAIResponse={onAIResponse}
        onCodeGenerated={onCodeGenerated}
      />
    );
  }

  // Default to full-access mode (original chat interface)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reasoning.trim()) {
      alert('Please provide your reasoning first');
      return;
    }

    if (onAIPrompt) {
      onAIPrompt(reasoning);
    }

    const response = await sendMessage(reasoning);
    
    if (response && onAIResponse) {
      onAIResponse(response);
    }

    setReasoning('');
  };

  return (
    <div className={`ai-sidebar ${isCollapsed ? 'ai-sidebar-collapsed' : ''}`}>
      <div className="ai-sidebar-header">
        <h3 className="ai-sidebar-title">💬 Full AI Access</h3>
        <div className="ai-sidebar-controls">
          <button
            className="ai-sidebar-button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '◀' : '▶'}
          </button>
        </div>
      </div>

      <div className="ai-sidebar-content">
        <div className="ai-chat-container">
          {messages.length === 0 && (
            <div className="ai-chat-empty">
              <p>Explain your reasoning to receive AI assistance</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`ai-chat-message ${msg.role === 'user' ? 'ai-chat-message-user' : 'ai-chat-message-ai'}`}
            >
              <div className="ai-chat-header">
                {msg.role === 'user' ? '👤 You' : '🤖 AI'}
              </div>
              <div className="ai-chat-text">{msg.content}</div>
            </div>
          ))}
          
          {isLoading && (
            <div className="ai-chat-loading">
              AI is thinking...
            </div>
          )}
          
          {error && (
            <div className="ai-error-message">
              {error}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="ai-form-container mt-auto">
          <textarea
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            placeholder="Explain what you're trying to do..."
            className="ai-form-textarea"
            disabled={isLoading}
            rows={3}
          />
          <button
            type="submit"
            className="ai-form-button"
            disabled={isLoading || !reasoning.trim()}
          >
            {isLoading ? 'Requesting...' : 'Get AI Help'}
          </button>
        </form>

      </div>
    </div>
  );
};
