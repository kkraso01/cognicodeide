import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { CodeEditor } from '../components/CodeEditor';
import { AIHelpPanel } from '../components/AIHelpPanel';
import { TaskPane } from '../components/TaskPane';
import { AIPreferenceModal } from '../components/AIPreferenceModal';
import { FileExplorer, FileNode } from '../components/FileExplorer';
import { useAssignmentStore } from '../state/assignmentStore';
import { useSessionLogger } from '../hooks/useSessionLogger';
import { api } from '../utils/apiClient';
import { ParsonsPanel } from '../components/ParsonsPanel';
import { LeadAndRevealPanel } from '../components/LeadAndRevealPanel';
import { TraceAndPredictPanel } from '../components/TraceAndPredictPanel';

export const StudentWorkspace: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { currentAssignment, fetchAssignment } = useAssignmentStore();
  
  // Initialize attemptId from sessionStorage if available
  const [attemptId, setAttemptId] = useState<number | null>(() => {
    const stored = sessionStorage.getItem(`attempt_${assignmentId}`);
    return stored ? parseInt(stored) : null;
  });
  
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openTabs, setOpenTabs] = useState<FileNode[]>([]); // Track open files in tabs
  const [currentFile, setCurrentFile] = useState<FileNode | null>(null);
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showAIModal, setShowAIModal] = useState(() => {
    // Don't show modal if we already have an active attempt
    const stored = sessionStorage.getItem(`attempt_${assignmentId}`);
    return !stored;
  });
  const [studentAIChoice, setStudentAIChoice] = useState<string>(() => {
    const stored = sessionStorage.getItem(`aiChoice_${assignmentId}`);
    return stored || 'none';
  });
  const [showAIPanel, setShowAIPanel] = useState(() => {
    const stored = sessionStorage.getItem(`aiChoice_${assignmentId}`);
    return stored ? stored !== 'none' : false;
  });
  const [saveStatus, setSaveStatus] = useState<'saved' | 'submitted' | null>(null);
  const lastCodeRef = useRef('');

  const {
    isLogging,
    startLogging,
    stopLogging,
    logEdit,
    logPaste,
    logRun,
    logAIPrompt,
    logAIResponse,
    logEvent,
  } = useSessionLogger(attemptId);

  useEffect(() => {
    if (assignmentId) {
      fetchAssignment(parseInt(assignmentId));
    }
  }, [assignmentId, fetchAssignment]);

  const hasInitializedWorkspace = useRef(false);

  // Auto-start logging when attemptId is set
  useEffect(() => {
    if (attemptId) {
      console.log('📝 attemptId changed, calling startLogging():', attemptId);
      startLogging();
    }
  }, [attemptId, startLogging]);

  // Handle Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attemptId, files, currentFile, code]);

  const startAttempt = async (aiChoice: string) => {
    if (!currentAssignment) return;
    
    try {
      const attempt = await api.createAttempt({
        assignment_id: currentAssignment.id,
        mode: 'practice',
        student_ai_choice: aiChoice,
      });
      console.log(' Created attempt, setting attemptId:', attempt.id);
      setAttemptId(attempt.id);
      setStudentAIChoice(aiChoice);
      // Save attemptId to sessionStorage so it persists across page reloads
      sessionStorage.setItem(`attempt_${currentAssignment.id}`, attempt.id.toString());
      // Don't call startLogging() here - let useEffect handle it!
    } catch (error) {
      console.error('Failed to start attempt:', error);
    }
  };

  const handleAIChoice = (choice: string) => {
    startAttempt(choice);
    setShowAIModal(false);
    setStudentAIChoice(choice);
    // Persist the choice to sessionStorage
    sessionStorage.setItem(`aiChoice_${assignmentId}`, choice);
    // Show AI panel if user chose to use AI
    if (choice !== 'none') {
      setShowAIPanel(true);
    }
  };

  const handleCodeGenerated = (generatedCode: string) => {
    // Update the current file with the generated code
    setCode(generatedCode);
    
    // Also update the files state
    const updatedFiles = files.map((f) =>
      f.path === currentFile?.path ? { ...f, content: generatedCode } : f
    );
    setFiles(updatedFiles);
    
    // Log the paste event
    logPaste(generatedCode);
  };

  // Initialize workspace: load latest attempt OR create new one (only once)
  useEffect(() => {
    if (assignmentId && currentAssignment && !hasInitializedWorkspace.current) {
      hasInitializedWorkspace.current = true;
      console.log('🚀 Initializing workspace for assignment', assignmentId);
      
      // Try to load latest attempt from database (not sessionStorage!)
      api.getLatestAttempt(parseInt(assignmentId))
        .then((attempt) => {
          console.log('📂 Found existing attempt:', attempt.id, 'finished:', !!attempt.finished_at);
          
          // Set attemptId and save to sessionStorage
          setAttemptId(attempt.id);
          sessionStorage.setItem(`attempt_${assignmentId}`, attempt.id.toString());
          sessionStorage.setItem(`aiChoice_${assignmentId}`, attempt.student_ai_choice);
          setStudentAIChoice(attempt.student_ai_choice);
          setShowAIModal(false); // Don't show modal if we have existing attempt
          
          if (attempt.student_ai_choice !== 'none') {
            setShowAIPanel(true);
          }
          
          // Load saved code if available
          if (attempt.final_code) {
            console.log('✅ Loading saved code from database');
            try {
              const savedFiles = JSON.parse(attempt.final_code);
              if (Array.isArray(savedFiles) && savedFiles.length > 0) {
                setFiles(savedFiles);
                setCurrentFile(savedFiles[0]);
                setOpenTabs([savedFiles[0]]); // Open first file in tab
                setCode(savedFiles[0].content || '');
                lastCodeRef.current = savedFiles[0].content || '';
                return; // Don't load starter code
              }
            } catch (e) {
              console.error('Failed to parse saved code:', e);
            }
          }
          
          // If no saved code, fall back to starter code
          initializeFromStarterCode();
        })
        .catch(() => {
          // No attempt exists yet - show AI modal to create one
          console.log('📝 No existing attempt, will create new one');
          initializeFromStarterCode();
          setShowAIModal(true); // Show modal to create new attempt
        });
    }
    
    function initializeFromStarterCode() {
      if (!currentAssignment) return;
      
      const fileStructure: FileNode[] = [];

      // Parse starter_code files
      if (currentAssignment.starter_code) {
        try {
          const starterFiles = JSON.parse(currentAssignment.starter_code);
          starterFiles.forEach((file: any) => {
            fileStructure.push({
              name: file.name,
              path: `/${file.path || file.name}`,
              type: 'file',
              content: file.content || '',
            });
          });
        } catch (e) {
          console.error('Failed to parse starter_code:', e);
          // Fallback: if starter_code is plain string, create single file
          const mainFileName = getMainFileName(currentAssignment.language);
          fileStructure.push({
            name: mainFileName,
            path: `/${mainFileName}`,
            type: 'file',
            content: currentAssignment.starter_code || '',
          });
        }
      }

      // Add support files if any
      if (currentAssignment.support_files) {
        try {
          const supportFiles = JSON.parse(currentAssignment.support_files);
          supportFiles.forEach((file: any) => {
            fileStructure.push({
              name: file.name,
              path: `/${file.path || file.name}`,
              type: 'file',
              content: file.content || '',
            });
          });
        } catch (e) {
          console.error('Failed to parse support files:', e);
        }
      }

      // Set first file as current
      const firstFile = fileStructure[0] || {
        name: getMainFileName(currentAssignment.language),
        path: `/${getMainFileName(currentAssignment.language)}`,
        type: 'file',
        content: '',
      };

      setFiles(fileStructure.length > 0 ? fileStructure : [firstFile]);
      setCurrentFile(firstFile);
      setOpenTabs([firstFile]); // Open first file in tab
      setCode(firstFile.content || '');
      lastCodeRef.current = firstFile.content || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, currentAssignment]);

  const getMainFileName = (language: string): string => {
    switch (language.toLowerCase()) {
      case 'python':
        return 'main.py';
      case 'java':
        return 'Main.java';
      case 'c':
        return 'main.c';
      case 'cpp':
        return 'main.cpp';
      default:
        return 'main.txt';
    }
  };

  const handleFileSelect = (file: FileNode) => {
    // Get the latest version from files array (source of truth)
    const targetFile = files.find(f => f.path === file.path);
    if (!targetFile) return;

    // Add to open tabs if not already open (use the file from files array)
    if (!openTabs.find(tab => tab.path === file.path)) {
      setOpenTabs(prev => [...prev, targetFile]);
    }

    // Log file switch event
    logEvent('file_switch', { from: currentFile?.path, to: targetFile.path });

    // Switch to selected file - use content from files array
    setCurrentFile(targetFile);
    setCode(targetFile.content || '');
    lastCodeRef.current = targetFile.content || '';
  };

  const handleTabSwitch = (file: FileNode) => {
    // Always get the latest file content from files array (source of truth)
    const targetFile = files.find(f => f.path === file.path);
    if (!targetFile) return;

    // Log file switch event
    logEvent('file_switch', { from: currentFile?.path, to: targetFile.path });

    // Switch to tab - use content from files array (source of truth)
    setCurrentFile(targetFile);
    setCode(targetFile.content || '');
    lastCodeRef.current = targetFile.content || '';
  };

  const handleTabClose = (e: React.MouseEvent, fileToClose: FileNode) => {
    e.stopPropagation();
    
    const newOpenTabs = openTabs.filter(tab => tab.path !== fileToClose.path);
    setOpenTabs(newOpenTabs);

    // If closing current file, switch to another tab
    if (currentFile?.path === fileToClose.path) {
      if (newOpenTabs.length > 0) {
        const nextTabPath = newOpenTabs[newOpenTabs.length - 1].path;
        // Get the actual file content from files array
        const nextFile = files.find(f => f.path === nextTabPath);
        if (nextFile) {
          setCurrentFile(nextFile);
          setCode(nextFile.content || '');
          lastCodeRef.current = nextFile.content || '';
        }
      } else {
        setCurrentFile(null);
        setCode('');
        lastCodeRef.current = '';
      }
    }
  };

  const handleFileCreate = (parentPath: string, name: string, type: 'file' | 'folder') => {
    const newFile: FileNode = {
      name,
      path: `${parentPath}${name}`,
      type,
      content: type === 'file' ? '' : undefined,
      children: type === 'folder' ? [] : undefined,
    };
    setFiles((prev) => [...prev, newFile]);
  };

  const handleFileDelete = (path: string) => {
    setFiles((prev) => prev.filter((f) => f.path !== path));
    if (currentFile?.path === path) {
      setCurrentFile(files[0] || null);
      setCode(files[0]?.content || '');
    }
  };

  const handleCodeChange = useCallback((newCode: string | undefined) => {
    if (newCode === undefined) return;
    
    console.log(' handleCodeChange called:', { 
      length: newCode.length, 
      isLogging, 
      attemptId 
    });
    
    setCode(newCode);
    
    // Update the current file in both files and openTabs arrays
    if (currentFile) {
      setFiles((prevFiles) =>
        prevFiles.map((f) =>
          f.path === currentFile.path ? { ...f, content: newCode } : f
        )
      );
      setOpenTabs((prevTabs) =>
        prevTabs.map((t) =>
          t.path === currentFile.path ? { ...t, content: newCode } : t
        )
      );
    }
    
    logEdit(newCode); // Pass the full code, logger handles diffing internally
  }, [isLogging, attemptId, logEdit, currentFile]);

  const handleRun = async () => {
    if (!currentAssignment) return;
    
    setIsRunning(true);
    setOutput('Running code...\n');
    logRun();

    try {
      // Files array is already up-to-date from handleCodeChange
      // Prepare files for execution API
      const execFiles = files.map((file) => ({
        name: file.name,
        content: file.content || '',
        is_main: file.path === currentFile?.path,
      }));

      // Execute code with all files
      const result = await api.executeCode({
        language: currentAssignment.language,
        files: execFiles,
        build_command: currentAssignment.build_command,
        run_command: currentAssignment.run_command,
        input_data: '',
      });
      
      // Format output
      let outputText = '';
      
      // Show build output if present
      if (result.build_output) {
        outputText += ' Build Phase:\n';
        if (result.build_output.stdout) {
          outputText += result.build_output.stdout + '\n';
        }
        if (result.build_output.stderr) {
          outputText += ' Build warnings:\n' + result.build_output.stderr + '\n';
        }
        outputText += `Build time: ${result.build_output.execution_time.toFixed(3)}s\n\n`;
      }
      
      // Show execution status
      if (result.status === 'success') {
        outputText += ' Execution completed successfully\n\n';
      } else if (result.status === 'error') {
        outputText += ' Execution failed\n\n';
      } else if (result.status === 'timeout') {
        outputText += ' Execution timed out\n\n';
      } else if (result.status === 'compilation_error') {
        outputText += ' Compilation error\n\n';
      }
      
      // Show stdout
      if (result.stdout) {
        outputText += ' Output:\n';
        outputText += result.stdout + '\n';
      }
      
      // Show stderr
      if (result.stderr) {
        outputText += ' Errors:\n';
        outputText += result.stderr + '\n';
      }
      
      // Show execution stats
      outputText += `\n Execution time: ${result.execution_time.toFixed(3)}s`;
      outputText += `\n Exit code: ${result.exit_code}`;
      
      setOutput(outputText);
    } catch (error: any) {
      setOutput(` Failed to execute code:\n${error.response?.data?.detail || error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!attemptId) return;
    
    try {
      // Stop logging and wait for events to upload
      await stopLogging();
      
      // Files array is already up-to-date from handleCodeChange
      // Submit with full project state (marks as finished)
      await api.finishAttempt(attemptId, JSON.stringify(files));
      
      // DON'T clear sessionStorage - student can reopen and continue editing
      // The attempt remains accessible with all events
      
      // Show green submit animation
      setSaveStatus('submitted');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      console.error('Failed to submit:', error);
    }
  };

  const handleSave = async () => {
    if (!attemptId) return;
    try {
      // Files array is already up-to-date from handleCodeChange
      // Just save the current state
      await api.saveAttempt(attemptId, { code: JSON.stringify(files) });
      
      // Show blue save animation
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to start completely fresh? This will create a NEW attempt.')) {
      try {
        // Clear current attempt from sessionStorage
        sessionStorage.removeItem(`attempt_${assignmentId}`);
        sessionStorage.removeItem(`aiChoice_${assignmentId}`);
        
        // Create a new attempt (will show AI modal)
        window.location.reload();
      } catch (error) {
        console.error('Failed to reset:', error);
      }
    }
  };

  if (!currentAssignment) {
    return (
      <div className="loading">Loading assignment...</div>
    );
  }

  return (
    <>
      {showAIModal && (
        <AIPreferenceModal
          assignmentAIMode={currentAssignment.ai_mode}
          onSelect={handleAIChoice}
          onClose={() => setShowAIModal(false)}
        />
      )}
      
      <div className="workspace-container">
        <div className="workspace-explorer">
          <FileExplorer
            files={files}
            currentFile={currentFile?.path || ''}
            onFileSelect={handleFileSelect}
            onFileCreate={handleFileCreate}
            onFileDelete={handleFileDelete}
          />
        </div>

        <div className="workspace-main">
          <div className="workspace-task-pane">
            <TaskPane
              assignment={currentAssignment}
              onRun={handleRun}
              onSubmit={handleSubmit}
              onSave={handleSave}
              onReset={handleReset}
              output={output}
              isRunning={isRunning}
            />
          </div>
          
          <div className="workspace-editor-area">
            {/* Multi-tab bar */}
            {openTabs.length > 0 && (
              <div className="workspace-editor-header">
                <div className="workspace-tabs">
                  {openTabs.map(tab => (
                    <div
                      key={tab.path}
                      className={`workspace-tab ${currentFile?.path === tab.path ? 'active' : ''}`}
                      onClick={() => handleTabSwitch(tab)}
                    >
                      <span className="workspace-tab-icon">📄</span>
                      <span className="workspace-tab-name">{tab.name}</span>
                      <button
                        className="workspace-tab-close"
                        onClick={(e) => handleTabClose(e, tab)}
                        title="Close"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Editor */}
            {currentFile ? (
              <div className={`editor-wrapper ${saveStatus === 'saved' ? 'flash-saved' : ''} ${saveStatus === 'submitted' ? 'flash-submitted' : ''}`}>
                <CodeEditor
                  language={currentAssignment.language}
                  initialValue={code}
                  onChange={handleCodeChange}
                  onPaste={logPaste}
                />
              </div>
            ) : (
              <div className="editor-empty-state">
                <p>Select a file from the explorer to start coding</p>
              </div>
            )}
          </div>

          {/* AI Panel Sidebars - render directly as fixed-position modals */}
          {showAIPanel && studentAIChoice === 'lead-and-reveal' && (
            <LeadAndRevealPanel
              attemptId={attemptId}
              onAIPrompt={logAIPrompt}
              onAIResponse={logAIResponse}
            />
          )}
          {showAIPanel && studentAIChoice === 'trace-and-predict' && (
            <TraceAndPredictPanel
              attemptId={attemptId}
              onAIPrompt={logAIPrompt}
              onAIResponse={logAIResponse}
            />
          )}
          {showAIPanel && studentAIChoice === 'parsons' && (
            <ParsonsPanel
              attemptId={attemptId}
              onAIPrompt={logAIPrompt}
              onAIResponse={logAIResponse}
              onCodeGenerated={handleCodeGenerated}
            />
          )}
          {showAIPanel && studentAIChoice === 'full-access' && (
            <AIHelpPanel
              attemptId={attemptId}
              aiMode="full-access"
              onAIPrompt={logAIPrompt}
              onAIResponse={logAIResponse}
              onCodeGenerated={handleCodeGenerated}
            />
          )}
        </div>
      </div>
    </>
  );
};
