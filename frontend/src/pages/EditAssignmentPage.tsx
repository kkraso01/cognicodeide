import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../utils/apiClient';

interface Assignment {
  id: number;
  title: string;
  description: string;
  language: string;
  ai_mode: string;
  starter_code: string | null;
  support_files?: string | null;
  test_cases: string | null;
  build_command?: string | null;
  run_command?: string | null;
}

export const EditAssignmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { assignmentId } = useParams<{ assignmentId: string }>();
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
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        const assignment = await apiClient.get<Assignment>(
          `/api/assignments/${assignmentId}`
        );
        setFormData({
          title: assignment.title,
          description: assignment.description,
          language: assignment.language,
          ai_mode: assignment.ai_mode,
          test_cases: assignment.test_cases || '',
          build_command: assignment.build_command || '',
          run_command: assignment.run_command || '',
        });

        // Parse starter_code files
        if (assignment.starter_code) {
          try {
            const parsed = JSON.parse(assignment.starter_code);
            setStarterFiles(Array.isArray(parsed) ? parsed : []);
          } catch (e) {
            console.error('Failed to parse starter_code:', e);
          }
        }

        // Parse support_files
        if (assignment.support_files) {
          try {
            const parsed = JSON.parse(assignment.support_files);
            setSupportFiles(Array.isArray(parsed) ? parsed : []);
          } catch (e) {
            console.error('Failed to parse support_files:', e);
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to fetch assignment');
      } finally {
        setFetchLoading(false);
      }
    };

    fetchAssignment();
  }, [assignmentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiClient.put(`/api/assignments/${assignmentId}`, {
        ...formData,
        starter_code: JSON.stringify(starterFiles),
        support_files: JSON.stringify(supportFiles),
      });
      navigate('/teacher');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this assignment?')) {
      return;
    }

    setLoading(true);
    try {
      await apiClient.delete(`/api/assignments/${assignmentId}`);
      navigate('/teacher');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete assignment');
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', fontSize: '18px' }}>
          Loading assignment...
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">Edit Assignment</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/teacher')}>
           Back to Dashboard
        </button>
      </header>

      <main className="page-content" style={{ display: 'flex', justifyContent: 'center' }}>
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '800px' }}>
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
              className="form-input"
              style={{ fontFamily: 'inherit', resize: 'vertical' }}
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

          <div className="form-group">
            <label className="form-label">
              Starter Code Files
              <span className="form-help-text"> - Code files students will edit</span>
            </label>
            <input
              type="file"
              multiple
              onChange={handleStarterFileUpload}
              className="file-input"
              accept=".py,.java,.js,.jsx,.ts,.tsx,.c,.cpp,.h,.hpp,.cs,.rb,.go,.rs,.php"
            />
            <div className="form-hint">
               Upload: .py, .java, .js, .ts, .c, .cpp files
            </div>
            {starterFiles.length > 0 && (
              <div className="file-list">
                {starterFiles.map((file, index) => (
                  <div key={index} className="file-item">
                    <span style={{ color: '#d4d4d4' }}> {file.name}</span>
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
            <label className="form-label">
              Support Files (Build/Config)
              <span className="form-help-text"> - Build files: requirements.txt, Makefile, etc.</span>
            </label>
            <input
              type="file"
              multiple
              onChange={handleSupportFileUpload}
              className="file-input"
              accept=".txt,.json,.xml,.gradle,.properties,.h,.hpp,.md,.csv,.makefile,.mk"
            />
            <div className="form-hint">
               Upload: requirements.txt, package.json, config files
            </div>
            {supportFiles.length > 0 && (
              <div className="file-list">
                {supportFiles.map((file, index) => (
                  <div key={index} className="file-item">
                    <span style={{ color: '#d4d4d4' }}> {file.name}</span>
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
              className="form-input"
              style={{ fontFamily: 'monospace', resize: 'vertical' }}
              placeholder="Provide test cases (JSON format)..."
            />
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

            <div className="form-group" style={{ marginTop: '16px' }}>
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

          <div className="form-actions" style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={loading}
            >
              Delete
            </button>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/teacher')}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
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
