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
  cursor_tracking_interval: number; // milliseconds
  batch_interval: number; // seconds
}

export const TeacherSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<LoggingSettings>({
    log_level: 'standard',
    track_keystrokes: true,
    track_cursor_moves: true,
    track_paste_events: true,
    track_ai_interactions: true,
    track_run_events: true,
    cursor_tracking_interval: 5000,
    batch_interval: 5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<LoggingSettings>('/api/teacher/logging-settings');
      setSettings(data);
    } catch (err: any) {
      // If settings don't exist yet, use defaults
      console.log('Using default settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await apiClient.put('/api/teacher/logging-settings', settings);
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handlePresetChange = (preset: 'verbose' | 'standard' | 'minimal') => {
    const presets: { [key: string]: LoggingSettings } = {
      verbose: {
        log_level: 'verbose',
        track_keystrokes: true,
        track_cursor_moves: true,
        track_paste_events: true,
        track_ai_interactions: true,
        track_run_events: true,
        cursor_tracking_interval: 2000,
        batch_interval: 3,
      },
      standard: {
        log_level: 'standard',
        track_keystrokes: true,
        track_cursor_moves: true,
        track_paste_events: true,
        track_ai_interactions: true,
        track_run_events: true,
        cursor_tracking_interval: 5000,
        batch_interval: 5,
      },
      minimal: {
        log_level: 'minimal',
        track_keystrokes: true,
        track_cursor_moves: false,
        track_paste_events: true,
        track_ai_interactions: true,
        track_run_events: true,
        cursor_tracking_interval: 10000,
        batch_interval: 10,
      },
    };
    setSettings(presets[preset]);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', fontSize: '18px' }}>
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">Logging Settings</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/teacher')}>
           Back to Dashboard
        </button>
      </header>

      <main className="page-content" style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '900px' }}>
          {error && <div className="auth-error" style={{ marginBottom: '20px' }}>{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <section className="settings-section">
            <h2 className="settings-section-title"> Logging Level Presets</h2>
            <p className="settings-section-desc">
              Choose a preset configuration or customize individual settings below.
            </p>

            <div className="preset-grid">
              <button
                className={`preset-card ${settings.log_level === 'verbose' ? 'active' : ''}`}
                onClick={() => handlePresetChange('verbose')}
              >
                <div className="preset-title"> Verbose</div>
                <div className="preset-desc">
                  Track everything in detail. Best for research or detailed analysis.
                </div>
              </button>

              <button
                className={`preset-card ${settings.log_level === 'standard' ? 'active' : ''}`}
                onClick={() => handlePresetChange('standard')}
              >
                <div className="preset-title"> Standard</div>
                <div className="preset-desc">
                  Balanced logging. Captures key interactions without overwhelming data.
                </div>
              </button>

              <button
                className={`preset-card ${settings.log_level === 'minimal' ? 'active' : ''}`}
                onClick={() => handlePresetChange('minimal')}
              >
                <div className="preset-title"> Minimal</div>
                <div className="preset-desc">
                  Essential events only. Reduces data storage and processing.
                </div>
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title"> Custom Settings</h2>
            <p className="settings-section-desc">
              Fine-tune what student activities to track.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={settings.track_keystrokes}
                  onChange={(e) =>
                    setSettings({ ...settings, track_keystrokes: e.target.checked })
                  }
                  style={{ marginTop: '4px' }}
                />
                <div className="setting-content">
                  <div className="setting-title">Track Keystrokes</div>
                  <div className="setting-desc">
                    Record code changes and editing patterns
                  </div>
                </div>
              </label>

              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={settings.track_cursor_moves}
                  onChange={(e) =>
                    setSettings({ ...settings, track_cursor_moves: e.target.checked })
                  }
                  style={{ marginTop: '4px' }}
                />
                <div className="setting-content">
                  <div className="setting-title">Track Cursor Movements</div>
                  <div className="setting-desc">
                    Monitor where students focus their attention (can generate large data)
                  </div>
                </div>
              </label>

              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={settings.track_paste_events}
                  onChange={(e) =>
                    setSettings({ ...settings, track_paste_events: e.target.checked })
                  }
                  style={{ marginTop: '4px' }}
                />
                <div className="setting-content">
                  <div className="setting-title">Track Paste Events</div>
                  <div className="setting-desc">
                    Detect when students paste code (potential AI-generated content)
                  </div>
                </div>
              </label>

              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={settings.track_ai_interactions}
                  onChange={(e) =>
                    setSettings({ ...settings, track_ai_interactions: e.target.checked })
                  }
                  style={{ marginTop: '4px' }}
                />
                <div className="setting-content">
                  <div className="setting-title">Track AI Interactions</div>
                  <div className="setting-desc">
                    Log all AI help requests and responses
                  </div>
                </div>
              </label>

              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={settings.track_run_events}
                  onChange={(e) =>
                    setSettings({ ...settings, track_run_events: e.target.checked })
                  }
                  style={{ marginTop: '4px' }}
                />
                <div className="setting-content">
                  <div className="setting-title">Track Code Runs</div>
                  <div className="setting-desc">
                    Record when students test their code
                  </div>
                </div>
              </label>
            </div>
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title"> Performance Settings</h2>
            <p className="settings-section-desc">
              Adjust how frequently data is collected and sent.
            </p>

            <div className="range-container">
              <div className="range-header">
                <span style={{ fontWeight: 'bold' }}>Cursor Tracking Interval</span>
                <span className="range-value">{settings.cursor_tracking_interval}ms</span>
              </div>
              <input
                type="range"
                min="1000"
                max="10000"
                step="1000"
                value={settings.cursor_tracking_interval}
                onChange={(e) =>
                  setSettings({ ...settings, cursor_tracking_interval: parseInt(e.target.value) })
                }
                className="range-input"
                disabled={!settings.track_cursor_moves}
              />
              <div className="range-hint">
                Lower = more frequent updates (more data). Higher = less frequent (less data).
              </div>
            </div>

            <div className="range-container">
              <div className="range-header">
                <span style={{ fontWeight: 'bold' }}>Batch Upload Interval</span>
                <span className="range-value">{settings.batch_interval}s</span>
              </div>
              <input
                type="range"
                min="3"
                max="30"
                step="1"
                value={settings.batch_interval}
                onChange={(e) =>
                  setSettings({ ...settings, batch_interval: parseInt(e.target.value) })
                }
                className="range-input"
              />
              <div className="range-hint">
                How often to send collected events to the server.
              </div>
            </div>
          </section>

          <div className="form-actions">
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/teacher')}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : ' Save Settings'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
