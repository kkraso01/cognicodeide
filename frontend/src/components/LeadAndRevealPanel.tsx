import React, { useState } from 'react';
import { AI_MODEL } from '../utils/constants';
import { api } from '../utils/apiClient';

interface LeadAndRevealPanelProps {
  attemptId?: number | null;
  onAIPrompt?: (prompt: string) => void;
  onAIResponse?: (response: string) => void;
}

interface CodeStep {
  question: string;
  context: string;
  codeLine: string;
  explanation: string;
  userAnswer: string;
  feedback: string;
  isRevealed: boolean;
  isCorrect: boolean;
}

export const LeadAndRevealPanel: React.FC<LeadAndRevealPanelProps> = ({
  attemptId,
  onAIPrompt,
  onAIResponse,
}) => {
  const [problemDescription, setProblemDescription] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<CodeStep[]>([]);
  const [userAnswer, setUserAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);

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
      const response = await api.leadAndReveal(
        problemDescription,
        attemptId,
        AI_MODEL.replace(':latest', '').replace(':4b', '').replace(':1b', '')
      );

      console.log(' Got structured Lead-and-Reveal response:', response);
      
      if (onAIResponse) {
        onAIResponse(JSON.stringify(response));
      }

      // Response is already a validated TypeScript object
      if (!response.steps || !Array.isArray(response.steps)) {
        throw new Error('Response does not contain steps array');
      }

      const initialSteps = response.steps.map((s: any) => ({
        question: s.question,
        context: s.context || '',
        codeLine: s.codeLine || s.code || '',
        explanation: s.explanation,
        userAnswer: '',
        feedback: '',
        isRevealed: false,
        isCorrect: false,
      }));
      
      setSteps(initialSteps);
      setSessionStarted(true);
      setCurrentStep(0);
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
      setIsLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!userAnswer.trim()) {
      setError('Please provide an answer');
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
              content: `You are evaluating a student's answer in the Lead-and-Reveal technique. 
The question was: "${steps[currentStep].question}"
The correct approach involves: "${steps[currentStep].explanation}"
The student answered: "${userAnswer}"

Provide constructive feedback. If the answer captures the key concept, say "Correct!" and explain why. If missing details, provide hints without giving away the full answer. 

IMPORTANT: Return ONLY valid JSON with no extra text. Format: 
{
  "isCorrect": true,
  "feedback": "your feedback here"
}`,
            },
            {
              role: 'user',
            content: userAnswer,
          },
        ],
        model: AI_MODEL.replace(':latest', '').replace(':4b', '').replace(':1b', ''),
        temperature: 0.7,
      }, attemptId);

      const fullResponse = data.choices?.[0]?.message?.content || '';

      console.log(' Feedback Response:', fullResponse);      try {
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
        
        // Update current step with feedback
        const updatedSteps = [...steps];
        updatedSteps[currentStep] = {
          ...updatedSteps[currentStep],
          userAnswer,
          feedback: parsed.feedback,
          isCorrect: parsed.isCorrect,
          isRevealed: parsed.isCorrect, // Reveal code when correct
        };
        setSteps(updatedSteps);

        // If correct, move to next step after a brief delay
        if (parsed.isCorrect && currentStep < steps.length - 1) {
          setTimeout(() => {
            setCurrentStep(currentStep + 1);
            setUserAnswer('');
          }, 2000);
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

  const resetSession = () => {
    setProblemDescription('');
    setSteps([]);
    setCurrentStep(0);
    setUserAnswer('');
    setSessionStarted(false);
    setError(null);
  };

  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!sessionStarted) {
    return (
      <div className={`ai-sidebar ${isCollapsed ? 'ai-sidebar-collapsed' : ''}`}>
        <div className="ai-sidebar-header">
          <h3 className="ai-sidebar-title">📝 Lead-and-Reveal</h3>
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
              <li>Describe the problem you want to solve</li>
              <li>Answer questions about each step of the solution</li>
              <li>Code is revealed step-by-step as you demonstrate understanding</li>
              <li>Learn by thinking through the problem before seeing the answer</li>
            </ol>
          </div>

          <div className="ai-form-container">
            <label className="ai-form-label">Describe your coding problem:</label>
            <textarea
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="Example: I need to write a function that finds the maximum value in a list..."
              className="ai-form-textarea"
              rows={5}
              disabled={isLoading}
            />
            <button
              onClick={startSession}
              className="ai-form-button"
              disabled={isLoading || !problemDescription.trim()}
            >
              {isLoading ? 'Generating Questions...' : 'Start Learning'}
            </button>
            {error && <div className="ai-error-message">{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  const currentStepData = steps[currentStep];
  
  // Get all revealed code lines so far
  const revealedCode = steps
    .slice(0, currentStep + 1)
    .filter(step => step.isRevealed)
    .map(step => step.codeLine)
    .join('\n');

  return (
    <div className={`ai-sidebar ${isCollapsed ? 'ai-sidebar-collapsed' : ''}`}>
      <div className="ai-sidebar-header">
        <h3 className="ai-sidebar-title">📝 Lead-and-Reveal</h3>
        <div className="ai-sidebar-controls">
          <button
            className="ai-sidebar-button"
            onClick={resetSession}
            title="Reset Session"
          >
            ↻
          </button>
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
        <div className="lead-reveal-container">
          <div className="lead-reveal-step-counter">
            Line {currentStep + 1} of {steps.length}
          </div>

          {/* Stacked layout for sidebar */}
          <div className="ai-sidebar-workspace">
            {/* Top: Questions and interaction */}
            <div className="ai-panel-section">
          {currentStepData.context && (
            <div className="ai-instructions lead-reveal-context">
              <p className="ai-form-label">Context:</p>
              <p className="m-0">{currentStepData.context}</p>
            </div>
          )}

          <div className="ai-form-container">
            <p className="ai-form-label">Question:</p>
            <p className="lead-reveal-question">{currentStepData.question}</p>
          </div>

          {!currentStepData.isCorrect ? (
            <div className="ai-form-container">
              <label className="ai-form-label">Your answer (natural language):</label>
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Describe what needs to be done at this step..."
                className="ai-form-textarea"
                rows={4}
                disabled={isLoading}
              />
              <button
                onClick={submitAnswer}
                className="ai-form-button"
                disabled={isLoading || !userAnswer.trim()}
              >
                {isLoading ? 'Checking...' : 'Submit Answer'}
              </button>
              
              {currentStepData.feedback && (
                <div className={`ai-feedback-box ${currentStepData.isCorrect ? 'ai-feedback-success' : 'ai-feedback-error'}`}>
                  <strong>{currentStepData.isCorrect ? '✓ Correct!' : '⚠ Think about this:'}</strong>
                  <p>{currentStepData.feedback}</p>
                </div>
              )}

              {error && <div className="ai-error-message">{error}</div>}
            </div>
          ) : (
            <div className="lead-reveal-feedback-success">
              <div className="ai-feedback-box ai-feedback-success">
                <strong>✓ Excellent!</strong>
                <p>{currentStepData.feedback}</p>
              </div>

              {currentStep < steps.length - 1 && (
                <p className="lead-reveal-moving-next">Moving to next line...</p>
              )}

              {currentStep === steps.length - 1 && (
                <div className="ai-feedback-box ai-feedback-success lead-reveal-complete">
                  <h4>✓ Complete!</h4>
                  <p>You've built the entire solution line by line.</p>
                  <button onClick={resetSession} className="ai-form-button mt-12">
                    Start New Problem
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

            {/* Bottom: Progressive code reveal */}
            <div className="ai-panel-section">
              <div className="ai-panel-title">
                Solution (Progressive Reveal)
              </div>
              
              {revealedCode ? (
                <div className="parsons-solution-container">
                  {steps.slice(0, currentStep + 1).map((step, idx) => 
                    step.isRevealed ? (
                      <div 
                        key={idx} 
                        className="code-block lead-reveal-code-line"
                        title={step.explanation}
                      >
                        <span className="indent-level lead-reveal-line-number">{idx + 1}</span>
                        <span className="code-block-code">{step.codeLine}</span>
                      </div>
                    ) : null
                  )}
                </div>
              ) : (
                <div className="ai-feedback-box lead-reveal-placeholder">
                  <p>Code will be revealed as you answer correctly...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



