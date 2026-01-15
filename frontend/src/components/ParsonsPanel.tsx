import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AI_MODEL } from '../utils/constants';
import { api } from '../utils/apiClient';

interface ParsonsPanelProps {
  attemptId?: number | null;
  onAIPrompt?: (prompt: string) => void;
  onAIResponse?: (response: string) => void;
  onCodeGenerated?: (code: string) => void;
}

interface CodeBlock {
  id: string;
  code: string;
  indent: number;
  correct_indent: number;
  position: number;
}

// Sortable block component with visual drop indicator
const SortableBlock: React.FC<{
  id: string;
  block: CodeBlock;
  onIndentChange: (blockId: string, newIndent: number) => void;
  isOver?: boolean;
}> = ({ id, block, onIndentChange, isOver }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <div 
        className={`parsons-block-wrapper ${isOver ? 'drag-over-top' : ''}`}
      >
        {isOver && <div className="parsons-drop-indicator" />}
        <div className="code-block">
          <span className="code-block-handle">⋮⋮</span>
          <code className="code-block-code">{block.code}</code>
          <div className="indent-controls">
            <button
              onClick={() => onIndentChange(block.id, block.indent - 1)}
              className="indent-btn"
              title="Decrease indent"
            >
              ←
            </button>
            <span className="indent-level">{block.indent}</span>
            <button
              onClick={() => onIndentChange(block.id, block.indent + 1)}
              className="indent-btn"
              title="Increase indent"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Dragging preview overlay
const DraggingBlockPreview: React.FC<{ block: CodeBlock | null }> = ({
  block,
}) => {
  if (!block) return null;
  return (
    <div className="parsons-drag-preview">
      <code className="code-block-code">{block.code}</code>
    </div>
  );
};

// Droppable container component
const DroppableContainer: React.FC<{
  id: string;
  children: React.ReactNode;
  className?: string;
  isOver?: boolean;
}> = ({ id, children, className, isOver }) => {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'parsons-container-over' : ''}`}
    >
      {children}
    </div>
  );
};


export const ParsonsPanel: React.FC<ParsonsPanelProps> = ({
  attemptId,
  onAIPrompt,
  onAIResponse,
  onCodeGenerated,
}) => {
  const [problemDescription, setProblemDescription] = useState('');
  const [availableBlocks, setAvailableBlocks] = useState<CodeBlock[]>([]);
  const [solutionBlocks, setSolutionBlocks] = useState<CodeBlock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedBlock, setDraggedBlock] = useState<CodeBlock | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

      const response = await api.parsonsProblem(
        problemDescription,
        attemptId,
        AI_MODEL.replace(':latest', '')
          .replace(':4b', '')
          .replace(':1b', '')
      );

      console.log('Got Parsons problem:', response);

      if (onAIResponse) {
        onAIResponse(JSON.stringify(response));
      }

      if (!response.blocks || !Array.isArray(response.blocks)) {
        throw new Error('Response does not contain blocks array');
      }

      const shuffledBlocks = response.blocks
        .map((block: any, idx: number) => ({
          id: `block-${idx}`,
          code: block.code,
          indent: block.indent,
          correct_indent: block.indent,
          position: idx,
        }))
        .sort(() => Math.random() - 0.5);

      setAvailableBlocks(shuffledBlocks);
      setSolutionBlocks([]);
      setSessionStarted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to start Parsons problem');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const blockId = active.id as string;

    const availableBlock = availableBlocks.find((b) => b.id === blockId);
    const solutionBlock = solutionBlocks.find((b) => b.id === blockId);
    const block = availableBlock || solutionBlock;

    if (block) {
      setDraggedBlock(block);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedBlock(null);
    setOverId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const isActiveInAvailable = availableBlocks.some((b) => b.id === activeId);
    const isActiveInSolution = solutionBlocks.some((b) => b.id === activeId);

    const isOverInAvailable = availableBlocks.some((b) => b.id === overId);
    const isOverInSolution = solutionBlocks.some((b) => b.id === overId);
    const isOverSolutionContainer = overId === 'solution-container';
    const isOverAvailableContainer = overId === 'available-container';

    if (isActiveInAvailable && (isOverInSolution || isOverSolutionContainer)) {
      const blockToMove = availableBlocks.find((b) => b.id === activeId);
      const overIndex = isOverSolutionContainer
        ? solutionBlocks.length
        : solutionBlocks.findIndex((b) => b.id === overId);
      
      if (blockToMove && overIndex !== -1) {
        setAvailableBlocks((prev) =>
          prev.filter((b) => b.id !== activeId)
        );
        setSolutionBlocks((prev) => {
          const updated = [...prev];
          updated.splice(overIndex, 0, blockToMove);
          return updated;
        });
      }
    } else if (isActiveInSolution && (isOverInAvailable || isOverAvailableContainer)) {
      const blockToMove = solutionBlocks.find((b) => b.id === activeId);
      if (blockToMove) {
        setSolutionBlocks((prev) =>
          prev.filter((b) => b.id !== activeId)
        );
        setAvailableBlocks((prev) => [...prev, blockToMove]);
      }
    } else if (isActiveInSolution && isOverInSolution) {
      const activeIndex = solutionBlocks.findIndex((b) => b.id === activeId);
      const overIndex = solutionBlocks.findIndex((b) => b.id === overId);
      if (activeIndex !== -1 && overIndex !== -1) {
        setSolutionBlocks((prev) => arrayMove(prev, activeIndex, overIndex));
      }
    } else if (isActiveInAvailable && isOverInAvailable) {
      const activeIndex = availableBlocks.findIndex((b) => b.id === activeId);
      const overIndex = availableBlocks.findIndex((b) => b.id === overId);
      if (activeIndex !== -1 && overIndex !== -1) {
        setAvailableBlocks((prev) =>
          arrayMove(prev, activeIndex, overIndex)
        );
      }
    }

    logEvent('parsons_drop', { from: activeId, to: overId });
  };

  const handleIndentChange = (blockId: string, newIndent: number) => {
    setSolutionBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, indent: Math.max(0, newIndent) } : b
      )
    );
  };

  const validateAnswer = async (): Promise<boolean> => {
    const isOrderCorrect = solutionBlocks.every((block, idx) => {
      const correctIdx = availableBlocks.findIndex((b) => b.code === block.code);
      return correctIdx === -1 || idx === correctIdx;
    });

    const isIndentCorrect = solutionBlocks.every(
      (block) => block.indent === block.correct_indent
    );

    if (!isOrderCorrect) {
      setFeedback('❌ Code order is incorrect. Check the sequence.');
      return false;
    }

    if (!isIndentCorrect) {
      setFeedback('❌ Indentation is incorrect. Check spacing.');
      return false;
    }

    return true;
  };

  const submitAnswer = async () => {
    if (!attemptId) {
      setError('No active attempt');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const isValid = await validateAnswer();

      if (isValid) {
        const finalCode = solutionBlocks
          .map((block) => ' '.repeat(block.indent * 2) + block.code)
          .join('\n');

        const data = await api.chat(
          {
            messages: [
              {
                role: 'system',
                content: `You are validating a Parsons puzzle solution. The student has correctly ordered code blocks and applied correct indentation. Provide brief encouraging feedback.`,
              },
              {
                role: 'user',
                content: `Student solution:\n${finalCode}`,
              },
            ],
            model: AI_MODEL.replace(':latest', '')
              .replace(':4b', '')
              .replace(':1b', ''),
            temperature: 0.7,
          },
          attemptId
        );

        const response = data.choices?.[0]?.message?.content || 'Great work!';
        setFeedback(`✅ ${response}`);

        if (onCodeGenerated) {
          onCodeGenerated(finalCode);
        }

        logEvent('answer_submitted', { type: 'parsons', success: true });
      } else {
        logEvent('answer_submitted', { type: 'parsons', success: false });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to validate answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const logEvent = (eventType: string, payload: any) => {
    console.log(`Event: ${eventType}`, payload);
  };

  const resetSession = () => {
    setProblemDescription('');
    setAvailableBlocks([]);
    setSolutionBlocks([]);
    setSessionStarted(false);
    setFeedback(null);
    setError(null);
  };

  const availableBlockIds = availableBlocks.map((b) => b.id);
  const solutionBlockIds = solutionBlocks.map((b) => b.id);

  if (!sessionStarted) {
    return (
      <div className={`ai-sidebar ${isCollapsed ? 'ai-sidebar-collapsed' : ''}`}>
        <div className="ai-sidebar-header">
          <h3 className="ai-sidebar-title">🧩 Parsons</h3>
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
            <p>
              <strong>How it works:</strong>
            </p>
            <ol>
              <li>Describe a coding problem</li>
              <li>AI generates shuffled code blocks</li>
              <li>Drag blocks to correct order</li>
              <li>Set correct indentation</li>
              <li>Submit when complete</li>
            </ol>
          </div>

          <div className="ai-form-container">
            <label className="ai-form-label">Describe your problem:</label>
            <textarea
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="Example: Write a function that reverses a list..."
              className="ai-form-textarea"
              disabled={isLoading}
            />
            <button
              onClick={startSession}
              className="ai-form-button parsons-generate-btn"
              disabled={isLoading || !problemDescription.trim()}
            >
              {isLoading ? '⏳ Generating...' : '✨ Generate'}
            </button>

            {error && <div className="ai-error-message">{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`ai-sidebar ${isCollapsed ? 'ai-sidebar-collapsed' : ''}`}>
      <div className="ai-sidebar-header">
        <h3 className="ai-sidebar-title">🧩 Parsons</h3>
        <div className="ai-sidebar-controls">
          <button
            onClick={resetSession}
            className="ai-sidebar-button"
            title="Reset and start over"
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={(event) => {
            setOverId(event.over?.id as string | null);
          }}
        >
          <div className="ai-sidebar-workspace">
            {/* Available Blocks Panel */}
            <div className="ai-panel-section">
              <h4 className="ai-panel-title">Available</h4>
              <SortableContext
                items={availableBlockIds}
                strategy={verticalListSortingStrategy}
              >
                <DroppableContainer
                  id="available-container"
                  className="parsons-blocks-container"
                  isOver={overId === 'available-container'}
                >
                  {availableBlocks.length === 0 ? (
                    <div className="parsons-empty-state">
                      Drag all blocks →
                    </div>
                  ) : (
                    availableBlocks.map((block) => (
                      <SortableBlock
                        key={block.id}
                        id={block.id}
                        block={block}
                        onIndentChange={handleIndentChange}
                        isOver={overId === block.id}
                      />
                    ))
                  )}
                </DroppableContainer>
              </SortableContext>
            </div>

            {/* Solution Panel */}
            <div className="ai-panel-section">
              <h4 className="ai-panel-title">Solution</h4>
              <SortableContext
                items={solutionBlockIds}
                strategy={verticalListSortingStrategy}
              >
                <DroppableContainer
                  id="solution-container"
                  className="parsons-solution-container"
                  isOver={overId === 'solution-container'}
                >
                  {solutionBlocks.length === 0 ? (
                    <div className="parsons-empty-solution">
                      📍 Drag here
                    </div>
                  ) : (
                    solutionBlocks.map((block) => (
                      <SortableBlock
                        key={block.id}
                        id={block.id}
                        block={block}
                        onIndentChange={handleIndentChange}
                        isOver={overId === block.id}
                      />
                    ))
                  )}
                </DroppableContainer>
              </SortableContext>
            </div>
          </div>

          <DragOverlay>
            {draggedBlock && <DraggingBlockPreview block={draggedBlock} />}
          </DragOverlay>
        </DndContext>

        {/* Feedback */}
        {feedback && (
          <div
            className={`ai-feedback-box ${
              feedback.includes('❌')
                ? 'ai-feedback-error'
                : 'ai-feedback-success'
            }`}
          >
            {feedback}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={submitAnswer}
          disabled={isSubmitting || solutionBlocks.length === 0}
          className="ai-form-button parsons-submit-btn"
        >
          {isSubmitting ? '⏳ Validating...' : '✅ Submit'}
        </button>


        {error && <div className="ai-error-message">{error}</div>}
      </div>
    </div>
  );
};
