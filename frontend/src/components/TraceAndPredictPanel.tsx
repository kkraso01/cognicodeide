import React, { useState } from 'react';
import { AI_MODEL } from '../utils/constants';
import { api } from '../utils/apiClient';

interface TraceAndPredictPanelProps {
  attemptId?: number | null;
  onAIPrompt?: (prompt: string) => void;
  onAIResponse?: (response: string) => void;
}

interface Variable {
  name: string;
  value: string;
}

interface CodeBlock {
  code: string;
  lineStart: number;
  lineEnd: number;
  purpose: string;
  variables: Variable[];
  userPredictions: { [varName: string]: string };
  userExplanation: string;
  feedback: string;
  isCompleted: boolean;
}

export const TraceAndPredictPanel: React.FC<TraceAndPredictPanelProps> = ({
  attemptId,
  onAIPrompt,
  onAIResponse,
}) => {
  const [problemDescription, setProblemDescription] = useState('');
  const [sampleInput, setSampleInput] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [currentVariables, setCurrentVariables] = useState<Variable[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const startSession = async () => {
    if (!problemDescription.trim()) {
      setError('Please describe what you want to code');
      return;
    }

    if (!attemptId) {
      setError('No active attempt. Please start an assignment first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (onAIPrompt) {
        onAIPrompt(problemDescription);
      }

      // Call structured backend API (guarantees valid JSON via Pydantic validation + retry)
      const response = await api.traceAndPredict(
        problemDescription,
        attemptId,
        AI_MODEL.replace(':latest', '').replace(':4b', '').replace(':1b', '')
      );

      console.log(' Got structured Trace-and-Predict response:', response);
      
      if (onAIResponse) {
        onAIResponse(JSON.stringify(response));
      }

      // Response is already a validated TypeScript object with steps array
      if (!response.steps || !Array.isArray(response.steps)) {
        throw new Error('Response does not contain steps array');
      }

      // Convert steps to code blocks format (backwards compatible with existing UI)
      const initialBlocks = response.steps.map((step: any) => ({
        code: step.codeLine || '',
        lineStart: step.lineNumber || 0,
        lineEnd: step.lineNumber || 0,
        purpose: step.explanation || '',
        variables: [], // Not provided in new format, can be empty
        userPredictions: {},
        userExplanation: '',
        feedback: '',
        isCompleted: false,
      }));
      
      // Extract all unique code lines to form the complete code
      const allCodeLines = response.steps.map((s: any) => s.codeLine).join('\n');
      setGeneratedCode(allCodeLines);
      setSampleInput(sampleInput || ''); // Keep user's sample input
      setCodeBlocks(initialBlocks);
      setSessionStarted(true);
      setCurrentBlockIndex(0);
      setCurrentVariables([]);
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
      setIsLoading(false);
    }
  };

  const submitPrediction = async () => {
    const currentBlock = codeBlocks[currentBlockIndex];
    
    // Check if all predictions are filled
    const allPredictionsFilled = currentBlock.variables.every(
      (v) => currentBlock.userPredictions[v.name]?.trim()
    );
    
    if (!allPredictionsFilled || !currentBlock.userExplanation.trim()) {
      setError('Please predict all variable values and explain the code purpose');
      return;
    }

    if (!attemptId) {
      setError('No active attempt');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get feedback from AI via backend API
      const data = await api.chat({
        messages: [
          {
            role: 'system',
            content: `You are evaluating predictions in Trace-and-Predict technique.
Code block: ${currentBlock.code}
Block purpose: ${currentBlock.purpose}
Sample input: ${sampleInput}
Correct variable values AFTER this block executes: ${JSON.stringify(currentBlock.variables)}
Student predictions: ${JSON.stringify(currentBlock.userPredictions)}
Student explanation of block purpose: ${currentBlock.userExplanation}

Evaluate if:
1. Variable predictions are correct (values after block execution)
2. The explanation captures the block's purpose

IMPORTANT: Return ONLY valid JSON with no extra text. Format:
{
  "isCompleted": true,
  "feedback": "detailed feedback on predictions and explanation"
}`,
          },
          {
            role: 'user',
            content: 'Evaluate my predictions',
          },
        ],
        model: AI_MODEL.replace(':latest', '').replace(':4b', '').replace(':1b', ''),
        temperature: 0.7,
      }, attemptId);

      const fullResponse = data.choices?.[0]?.message?.content || '';
      console.log(' Feedback Response:', fullResponse);

      try {
        // Extract JSON from various formats
        let jsonStr = fullResponse.trim();
        
        // Try to find JSON in markdown code blocks
        const markdownMatch = fullResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (markdownMatch) {
          jsonStr = markdownMatch[1].trim();
          console.log(' Extracted JSON from markdown:', jsonStr);
        }
        
        // Try to find JSON object in the text (find first { and last })
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
          console.log(' Extracted JSON object:', jsonStr);
        }

        const parsed = JSON.parse(jsonStr);
        console.log(' Parsed Feedback JSON:', parsed);
        
        // Update current block
        const updatedBlocks = [...codeBlocks];
        updatedBlocks[currentBlockIndex] = {
          ...updatedBlocks[currentBlockIndex],
          feedback: parsed.feedback,
          isCompleted: parsed.isCompleted,
        };
        setCodeBlocks(updatedBlocks);

        // Update current variables for display
        if (parsed.isCompleted) {
          setCurrentVariables([
            ...currentVariables,
            ...currentBlock.variables,
          ]);

          // Move to next block after delay
          if (currentBlockIndex < codeBlocks.length - 1) {
            setTimeout(() => {
              setCurrentBlockIndex(currentBlockIndex + 1);
            }, 2000);
          }
        }
      } catch (e) {
        console.error(' Feedback Parse Error:', e);
        console.error(' Feedback Response was:', fullResponse);
        setError(`Failed to parse feedback. Raw response: ${fullResponse.substring(0, 200)}...`);
      }

      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to get feedback');
      setIsLoading(false);
    }
  };

  const updatePrediction = (varName: string, value: string) => {
    const updatedBlocks = [...codeBlocks];
    updatedBlocks[currentBlockIndex].userPredictions[varName] = value;
    setCodeBlocks(updatedBlocks);
  };

  const updateExplanation = (explanation: string) => {
    const updatedBlocks = [...codeBlocks];
    updatedBlocks[currentBlockIndex].userExplanation = explanation;
    setCodeBlocks(updatedBlocks);
  };

  const resetSession = () => {
    setProblemDescription('');
    setSampleInput('');
    setGeneratedCode('');
    setCodeBlocks([]);
    setCurrentBlockIndex(0);
    setSessionStarted(false);
    setCurrentVariables([]);
    setError(null);
  };

  if (!sessionStarted) {
    return (
      <div className={`ai-sidebar ${isCollapsed ? 'ai-sidebar-collapsed' : ''}`}>
        <div className="ai-sidebar-header">
          <h3 className="ai-sidebar-title">🔍 Trace-and-Predict</h3>
          <div className="ai-sidebar-controls">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="ai-sidebar-button"
              title="Collapse/Expand"
            >
              {isCollapsed ? '◀' : '▶'}
            </button>
          </div>
        </div>

        <div className="ai-sidebar-content">
          <div className="ai-instructions">
            <p><strong>How it works:</strong></p>
            <ol>
              <li>AI generates code for your problem</li>
              <li>Step through the code execution with sample input</li>
              <li>Predict variable values at key points</li>
              <li>Explain what each code block does</li>
              <li>Learn by actively tracing execution flow</li>
            </ol>
          </div>

          <div className="ai-form-container">
            <label className="ai-form-label">Describe your coding problem:</label>
            <textarea
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="Example: Write a function that calculates the factorial of a number..."
              className="ai-form-textarea"
              rows={4}
              disabled={isLoading}
            />

            <label className="ai-form-label" style={{ marginTop: '12px' }}>Sample input (optional):</label>
            <input
              type="text"
              value={sampleInput}
              onChange={(e) => setSampleInput(e.target.value)}
              placeholder="Example: 5"
              className="ai-form-textarea"
              style={{ minHeight: 'auto', height: '36px' }}
              disabled={isLoading}
            />

            <button
              onClick={startSession}
              className="ai-form-button"
              disabled={isLoading || !problemDescription.trim()}
              style={{ marginTop: '12px' }}
            >
              {isLoading ? 'Generating Code...' : 'Start Tracing'}
            </button>
            {error && <div className="ai-error-message">{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  const currentBlock = codeBlocks[currentBlockIndex];

  return (
    <div className={`ai-sidebar ${isCollapsed ? 'ai-sidebar-collapsed' : ''}`}>
      <div className="ai-sidebar-header">
        <h3 className="ai-sidebar-title">🔍 Trace-and-Predict</h3>
        <div className="ai-sidebar-controls">
          <button
            onClick={resetSession}
            className="ai-sidebar-button"
            title="Reset Session"
          >
            ↻
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="ai-sidebar-button"
            title="Collapse/Expand"
          >
            {isCollapsed ? '◀' : '▶'}
          </button>
        </div>
      </div>

      <div className="ai-sidebar-content">
        <div className="trace-content-wrapper">
          <div className="trace-block-counter">
            Block {currentBlockIndex + 1} of {codeBlocks.length}
          </div>

          <div className="trace-code-container">
            <div className="trace-code-header">
              <strong>Generated Code:</strong>
              {sampleInput && <span className="trace-input-badge">Input: {sampleInput}</span>}
            </div>
            <pre className="trace-code-pre">{generatedCode}</pre>
          </div>

          {currentVariables.length > 0 && (
            <div className="trace-variables-container">
              <strong className="trace-variables-title">Current Variables:</strong>
              <div className="trace-variables-list">
                {currentVariables.map((v, i) => (
                  <div key={i} className="trace-variable-item">
                    <span className="trace-variable-name">{v.name}</span> = {v.value}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="trace-highlight-block">
            <p className="trace-highlight-title">
              Highlighted Block (Lines {currentBlock.lineStart}-{currentBlock.lineEnd}):
            </p>
            <pre className="trace-highlight-pre">
              {currentBlock.code}
            </pre>
          </div>

          {!currentBlock.isCompleted ? (
            <div className="ai-form-container m-0">
              <div className="trace-form-group">
                <label className="ai-form-label">Predict variable values:</label>
                {currentBlock.variables.map((variable) => (
                  <div key={variable.name} className="trace-prediction-row">
                    <span className="trace-prediction-label">{variable.name} =</span>
                    <input
                      type="text"
                      value={currentBlock.userPredictions[variable.name] || ''}
                      onChange={(e) => updatePrediction(variable.name, e.target.value)}
                      placeholder="Value"
                      className="ai-form-textarea trace-prediction-input"
                      disabled={isLoading}
                    />
                  </div>
                ))}
              </div>

              <div className="trace-form-group">
                <label className="ai-form-label">Explain what this block does:</label>
                <textarea
                  value={currentBlock.userExplanation}
                  onChange={(e) => updateExplanation(e.target.value)}
                  placeholder="Describe the purpose..."
                  className="ai-form-textarea"
                  rows={3}
                  disabled={isLoading}
                />
              </div>

              <button
                onClick={submitPrediction}
                className="ai-form-button"
                disabled={isLoading}
              >
                {isLoading ? 'Checking...' : 'Submit Prediction'}
              </button>

              {currentBlock.feedback && (
                <div className={`mt-12 ${currentBlock.isCompleted ? 'ai-feedback-success' : 'ai-feedback-error'}`}>
                  <strong>{currentBlock.isCompleted ? ' Correct!' : ' Not quite:'}</strong>
                  <p className="m-0 mt-4">{currentBlock.feedback}</p>
                </div>
              )}

              {error && <div className="ai-error-message mt-12">{error}</div>}
            </div>
          ) : (
            <div className="lead-reveal-container">
              <div className="ai-feedback-success">
                <strong> Excellent prediction!</strong>
                <p className="m-0 mt-4">{currentBlock.feedback}</p>
              </div>

              {currentBlockIndex < codeBlocks.length - 1 && (
                <p className="trace-moving-next">Moving to next block...</p>
              )}

              {currentBlockIndex === codeBlocks.length - 1 && (
                <div className="ai-feedback-success trace-complete-container">
                  <h4> Tracing Complete!</h4>
                  <p>You've successfully traced through the entire code execution.</p>
                  <button onClick={resetSession} className="ai-form-button mt-12">
                    Trace New Problem
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

