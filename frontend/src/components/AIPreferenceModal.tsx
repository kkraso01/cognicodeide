import React, { useState } from 'react';

interface AIPreferenceModalProps {
  assignmentAIMode: string;
  onSelect: (aiChoice: string) => void;
  onClose: () => void;
}

export const AIPreferenceModal: React.FC<AIPreferenceModalProps> = ({
  assignmentAIMode,
  onSelect,
  onClose,
}) => {
  const [selectedMode, setSelectedMode] = useState<string>('none');

  const handleConfirm = () => {
    onSelect(selectedMode);
    onClose();
  };

  const aiModes = [
    {
      value: 'none',
      label: 'No AI Assistance',
      description: 'Work independently without AI help',
      icon: '',
    },
    {
      value: 'lead-and-reveal',
      label: 'Lead-and-Reveal (Guided Learning)',
      description: 'Answer questions about each step before AI reveals the code',
      icon: '',
      disabled: assignmentAIMode === 'none',
    },
    {
      value: 'trace-and-predict',
      label: 'Trace-and-Predict (Code Analysis)',
      description: 'Trace AI code execution and predict variable values',
      icon: '',
      disabled: assignmentAIMode === 'none',
    },
    {
      value: 'parsons',
      label: 'Parsons Problem (Code Ordering)',
      description: 'Arrange and indent code blocks to solve the problem',
      icon: '',
      disabled: assignmentAIMode === 'none',
    },
    {
      value: 'full-access',
      label: 'Full AI Access (Direct)',
      description: 'Get direct AI assistance anytime without friction',
      icon: '',
      disabled: assignmentAIMode === 'none',
    },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Choose Your AI Assistance Level</h2>
          <button onClick={onClose} className="modal-close-btn">×</button>
        </div>

        <div className="modal-body">
          <p className="modal-subtitle">
            {assignmentAIMode === 'none' 
              ? 'This assignment does not allow AI assistance.'
              : 'Select how you want to use AI assistance for this assignment:'}
          </p>

          <div className="modal-options">
            {aiModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => !mode.disabled && setSelectedMode(mode.value)}
                disabled={mode.disabled}
                className={`modal-option ${selectedMode === mode.value ? 'selected' : ''}`}
              >
                <div className="modal-option-icon">{mode.icon}</div>
                <div className="modal-option-content">
                  <div className="modal-option-label">{mode.label}</div>
                  <div className="modal-option-desc">{mode.description}</div>
                </div>
                {selectedMode === mode.value && (
                  <div className="modal-checkmark">✓</div>
                )}
              </button>
            ))}
          </div>

          <div className="modal-notice">
             Your choice will be recorded. Teachers can see which AI assistance level you selected.
          </div>

          <div className="modal-actions">
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleConfirm} className="btn btn-primary">
              Start Assignment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
