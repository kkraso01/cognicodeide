import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../utils/apiClient';

interface LoggingSettings {
  log_level: 'verbose' | 'standard' | 'minimal';
  track_keystrokes: boolean;
  track_cursor_moves: boolean;
  track_paste_events: boolean;
  track_ai_interactions: boolean;
  track_run_events: boolean;
  cursor_tracking_interval: number;
  batch_interval: number;
}

export const CreateAssignmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    language: 'python',
    ai_mode: 'lead-and-reveal',
    test_cases: '',
    build_command: '',
    run_command: '',
  });
  const [starterFiles, setStarterFiles] = useState<Array<{ name: string; content: string; path: string }>>([]);
  const [supportFiles, setSupportFiles] = useState<Array<{ name: string; content: string; path: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Logging settings state
  const [useCustomLogging, setUseCustomLogging] = useState(false);
  const [teacherBaseSettings, setTeacherBaseSettings] = useState<LoggingSettings | null>(null);
  const [loggingSettings, setLoggingSettings] = useState<LoggingSettings | null>(null);

  // Fetch teacher's base logging settings on mount
  useEffect(() => {
    const fetchTeacherSettings = async () => {
      try {
        const settings = await apiClient.get('/api/teacher/logging-settings');
        setTeacherBaseSettings(settings);
      } catch (err) {
        console.error('Failed to fetch teacher settings:', err);
      }
    };
    fetchTeacherSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const assignmentData: any = {
        ...formData,
        starter_code: JSON.stringify(starterFiles),
        support_files: JSON.stringify(supportFiles),
      };
      
      // Include logging settings if custom settings are enabled
      if (useCustomLogging && loggingSettings) {
        assignmentData.logging_settings = JSON.stringify(loggingSettings);
      }
      
      await apiClient.post('/api/assignments', assignmentData);
      navigate('/teacher');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleStarterFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setStarterFiles((prev) => [
          ...prev,
          {
            name: file.name,
            content,
            path: file.name,
          },
        ]);
      };
      reader.readAsText(file);
    });
  };

  const handleSupportFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setSupportFiles((prev) => [
          ...prev,
          {
            name: file.name,
            content,
            path: file.name,
          },
        ]);
      };
      reader.readAsText(file);
    });
  };

  const handleRemoveStarterFile = (index: number) => {
    setStarterFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveSupportFile = (index: number) => {
    setSupportFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">Create Assignment</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/teacher')}>
           Back to Dashboard
        </button>
      </header>

      <main className="page-content page-content-centered">
        <form onSubmit={handleSubmit} className="form-wrapper">
          {error && <div className="auth-error" style={{ marginBottom: '20px' }}>{error}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="title">
              Assignment Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="form-input"
              placeholder="e.g., Fibonacci Sequence"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={6}
              className="form-input textarea-resize"
              placeholder="Provide a detailed problem description..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="language">
                Programming Language *
              </label>
              <select
                id="language"
                name="language"
                value={formData.language}
                onChange={handleChange}
                className="form-input"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="ai_mode">
                AI Mode *
              </label>
              <select
                id="ai_mode"
                name="ai_mode"
                value={formData.ai_mode}
                onChange={handleChange}
                className="form-input"
              >
                <option value="lead-and-reveal">Lead and Reveal</option>
                <option value="unrestricted">Unrestricted</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>

          {/* Logging Settings Section */}
          <div className="form-section">
            <div className="form-section-header">
              <h3 className="form-section-title"> Logging Settings</h3>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={useCustomLogging}
                  onChange={(e) => {
                    setUseCustomLogging(e.target.checked);
                    if (e.target.checked && teacherBaseSettings) {
                      setLoggingSettings({...teacherBaseSettings});
                    }
                  }}
                  className="checkbox-input"
                />
                <span>Override teacher's base settings for this assignment</span>
              </label>
            </div>
            
            {!useCustomLogging && teacherBaseSettings && (
              <div className="info-message">
                 This assignment will inherit your base logging settings ({teacherBaseSettings.log_level} mode)
              </div>
            )}
            
            {useCustomLogging && loggingSettings && (
              <div className="custom-logging-panel">
                <div className="form-group">
                  <label className="form-label">Logging Level</label>
                  <select
                    value={loggingSettings.log_level}
                    onChange={(e) => setLoggingSettings({
                      ...loggingSettings,
                      log_level: e.target.value as 'verbose' | 'standard' | 'minimal'
                    })}
                    className="form-input"
                  >
                    <option value="verbose">Verbose (detailed tracking)</option>
                    <option value="standard">Standard (balanced)</option>
                    <option value="minimal">Minimal (essential only)</option>
                  </select>
                </div>
                
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={loggingSettings.track_keystrokes}
                      onChange={(e) => setLoggingSettings({...loggingSettings, track_keystrokes: e.target.checked})}
                      className="checkbox-input"
                    />
                    Track keystrokes
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={loggingSettings.track_cursor_moves}
                      onChange={(e) => setLoggingSettings({...loggingSettings, track_cursor_moves: e.target.checked})}
                      className="checkbox-input"
                    />
                    Track cursor movements
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={loggingSettings.track_paste_events}
                      onChange={(e) => setLoggingSettings({...loggingSettings, track_paste_events: e.target.checked})}
                      className="checkbox-input"
                    />
                    Track paste events
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="form-group mt-20">
            <label className="form-label">
              Starter Code Files
              <span className="form-help-text"> - Code files students will edit (e.g., Java classes, Python modules)</span>
            </label>
            <input
              type="file"
              multiple
              onChange={handleStarterFileUpload}
              className="file-input"
              accept=".py,.java,.js,.jsx,.ts,.tsx,.c,.cpp,.h,.hpp,.cs,.rb,.go,.rs,.php"
            />
            <div className="form-hint">
               Upload: .py, .java, .js, .ts, .c, .cpp, .cs, .rb, .go, .rs files
            </div>
            {starterFiles.length > 0 && (
              <div className="file-list">
                {starterFiles.map((file, index) => (
                  <div key={index} className="file-item">
                    <span className="file-name"> {file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStarterFile(index)}
                      className="file-remove-btn"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="test_cases">
              Test Cases (Optional)
            </label>
            <textarea
              id="test_cases"
              name="test_cases"
              value={formData.test_cases}
              onChange={handleChange}
              rows={6}
              className="form-input monospace-textarea"
              placeholder="Provide test cases (JSON format)..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Support Files (Build/Config)
              <span className="form-help-text"> - Files for building/running: requirements.txt, Makefile, headers, etc.</span>
            </label>
            <input
              type="file"
              multiple
              onChange={handleSupportFileUpload}
              className="file-input"
              accept=".txt,.json,.xml,.gradle,.properties,.h,.hpp,.md,.csv,.makefile,.mk"
            />
            <div className="form-hint">
               Upload: requirements.txt, Makefile, package.json, .h files, config files
            </div>
            {supportFiles.length > 0 && (
              <div className="file-list">
                {supportFiles.map((file, index) => (
                  <div key={index} className="file-item">
                    <span className="file-name"> {file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSupportFile(index)}
                      className="file-remove-btn"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-section">
            <h3 className="form-section-title"> Build & Run Configuration</h3>
            <p className="form-section-help">
              Customize how the project is built and executed. Leave empty to use language defaults.
            </p>

            <div className="form-group">
              <label className="form-label" htmlFor="build_command">
                Build Command (Optional)
                <span className="form-help-text"> - Command to install dependencies or compile</span>
              </label>
              <input
                type="text"
                id="build_command"
                name="build_command"
                value={formData.build_command}
                onChange={handleChange}
                className="form-input"
                placeholder={getBuildCommandPlaceholder(formData.language)}
              />
              <div className="form-hint">
                 Examples: <code>pip install -r requirements.txt</code>, <code>npm install</code>, <code>make</code>
              </div>
            </div>

            <div className="form-group mt-16">
              <label className="form-label" htmlFor="run_command">
                Run Command (Optional)
                <span className="form-help-text"> - Command to execute the student's code</span>
              </label>
              <input
                type="text"
                id="run_command"
                name="run_command"
                value={formData.run_command}
                onChange={handleChange}
                className="form-input"
                placeholder={getRunCommandPlaceholder(formData.language)}
              />
              <div className="form-hint">
                 Examples: <code>python main.py</code>, <code>java Main</code>, <code>./app</code>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/teacher')}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Assignment'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

const getBuildCommandPlaceholder = (language: string): string => {
  const placeholders: { [key: string]: string } = {
    python: 'pip install -r requirements.txt',
    java: 'javac *.java',
    c: 'gcc *.c -o app',
    cpp: 'g++ *.cpp -o app',
  };
  return placeholders[language] || 'build command';
};

const getRunCommandPlaceholder = (language: string): string => {
  const placeholders: { [key: string]: string } = {
    python: 'python main.py',
    java: 'java Main',
    c: './app',
    cpp: './app',
  };
  return placeholders[language] || 'run command';
};
