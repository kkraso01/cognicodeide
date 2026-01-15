import React, { useState, useEffect } from 'react';
import { CodeEditor } from './CodeEditor';
import { api } from '../utils/apiClient';

interface ReplayViewerProps {
  attemptId: number;
}

export const ReplayViewer: React.FC<ReplayViewerProps> = ({ attemptId }) => {
  const [replayData, setReplayData] = useState<any>(null);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [metrics, setMetrics] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackTimerRef = React.useRef<number | null>(null);

  const loadReplayData = async () => {
    try {
      const data = await api.getReplay(attemptId);
      setReplayData(data);
    } catch (error) {
      console.error('Failed to load replay data:', error);
    }
  };

  const loadMetrics = async () => {
    try {
      const metricsData = await api.getReplayMetrics(attemptId);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  useEffect(() => {
    loadReplayData();
    loadMetrics();
    
    // Cleanup playback timer on unmount
    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  // Filter events to only include meaningful changes (skip duplicates)
  const getMeaningfulEvents = (): number[] => {
    if (!replayData || !replayData.events) return [];
    
    const meaningfulIndices: number[] = [0]; // Always include first event
    let lastCode = '';
    
    for (let i = 0; i < replayData.events.length; i++) {
      const event = replayData.events[i];
      if (event.type === 'edit') {
        try {
          const payload = JSON.parse(event.payload_json);
          const currentCode = payload.fullCode || '';
          
          // Only include if code actually changed
          if (currentCode !== lastCode) {
            meaningfulIndices.push(i);
            lastCode = currentCode;
          }
        } catch (e) {
          // Include event if we can't parse it
          meaningfulIndices.push(i);
        }
      } else {
        // Include non-edit events (run, paste, etc.)
        meaningfulIndices.push(i);
      }
    }
    
    return meaningfulIndices;
  };

  const reconstructCodeAtEvent = (eventIndex: number): string => {
    if (!replayData || !replayData.events) return '';
    
    // Get starter code from assignment
    let code = '';
    if (replayData.attempt?.assignment?.starter_code) {
      try {
        const starterFiles = JSON.parse(replayData.attempt.assignment.starter_code);
        // For single file, use first file's content
        code = starterFiles[0]?.content || '';
      } catch (e) {
        console.error('Error parsing starter code:', e);
        code = replayData.attempt.assignment.starter_code || '';
      }
    }
    
    // Apply events up to current index
    for (let i = 0; i <= eventIndex && i < replayData.events.length; i++) {
      const event = replayData.events[i];
      if (event.type === 'edit') {
        try {
          const payload = JSON.parse(event.payload_json);
          // Use fullCode field (what useSessionLogger stores)
          if (payload.fullCode !== undefined) {
            code = payload.fullCode;
          }
        } catch (e) {
          console.error('Error parsing event:', e);
        }
      }
    }
    
    return code;
  };

  const handlePlayPause = () => {
    const meaningfulEvents = getMeaningfulEvents();
    
    if (isPlaying) {
      // Pause
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      setIsPlaying(false);
    } else {
      // Play
      setIsPlaying(true);
      playbackTimerRef.current = setInterval(() => {
        setCurrentEventIndex((prev) => {
          // Find current position in meaningful events
          const currentMeaningfulIndex = meaningfulEvents.findIndex(idx => idx >= prev);
          
          // Get next meaningful event
          if (currentMeaningfulIndex < meaningfulEvents.length - 1) {
            return meaningfulEvents[currentMeaningfulIndex + 1];
          } else {
            // Reached end
            if (playbackTimerRef.current) {
              clearInterval(playbackTimerRef.current);
              playbackTimerRef.current = null;
            }
            setIsPlaying(false);
            return prev;
          }
        });
      }, 1000 / playbackSpeed) as unknown as number; // Advance every second / speed
    }
  };

  const jumpToStart = () => {
    setCurrentEventIndex(0);
    setIsPlaying(false);
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  };

  const jumpToEnd = () => {
    if (replayData) {
      setCurrentEventIndex(replayData.events.length - 1);
      setIsPlaying(false);
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value);
    setCurrentEventIndex(newIndex);
    setIsPlaying(false);
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  };

  if (!replayData) {
    return <div className="replay-loading">Loading replay...</div>;
  }

  const currentCode = reconstructCodeAtEvent(currentEventIndex);
  const currentEvent = replayData.events[currentEventIndex];

  return (
    <div className="replay-container">
      <div className="replay-sidebar">
        <h2 className="replay-title">Session Replay</h2>
        
        {metrics && (
          <div className="replay-metrics">
            <h3>Engagement Metrics</h3>
            <div className="replay-metric">
              <span>Active Typing:</span>
              <span>{Math.round(metrics.active_typing_time)}s</span>
            </div>
            <div className="replay-metric">
              <span>Paste Count:</span>
              <span>{metrics.paste_count}</span>
            </div>
            <div className="replay-metric">
              <span>AI Interactions:</span>
              <span>{metrics.ai_interaction_count}</span>
            </div>
            <div className="replay-metric">
              <span>Run Count:</span>
              <span>{metrics.run_count}</span>
            </div>
            <div className="replay-metric">
              <span>Session Length:</span>
              <span>{Math.round(metrics.session_length)}s</span>
            </div>
          </div>
        )}

        <div className="replay-controls">
          <button onClick={jumpToStart} className="replay-btn" title="Jump to start">
            
          </button>
          <button
            onClick={() => setCurrentEventIndex(Math.max(0, currentEventIndex - 1))}
            className="replay-btn"
            disabled={currentEventIndex === 0}
            title="Previous event"
          >
            
          </button>
          <button onClick={handlePlayPause} className="replay-btn-large" title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '' : ''}
          </button>
          <button
            onClick={() => setCurrentEventIndex(Math.min(replayData.events.length - 1, currentEventIndex + 1))}
            className="replay-btn"
            disabled={currentEventIndex === replayData.events.length - 1}
            title="Next event"
          >
            
          </button>
          <button onClick={jumpToEnd} className="replay-btn" title="Jump to end">
            
          </button>
        </div>

        <div className="replay-speed-control">
          <label className="replay-label">Speed: {playbackSpeed}</label>
          <input
            type="range"
            min="0.25"
            max="10"
            step="0.25"
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="replay-slider"
          />
        </div>

        <div className="replay-progress-bar">
          <input
            type="range"
            min="0"
            max={Math.max(0, replayData.events.length - 1)}
            value={currentEventIndex}
            onChange={handleSliderChange}
            className="replay-progress-slider"
          />
        </div>

        <div className="replay-timeline">
          <p><strong>Event {currentEventIndex + 1} of {replayData.events.length}</strong></p>
          {currentEvent && (
            <div className="replay-event-details">
              <p><strong>Type:</strong> {currentEvent.type}</p>
              <p><strong>Time:</strong> {currentEvent.t.toFixed(2)}s</p>
              <p><strong>Seq:</strong> {currentEvent.seq}</p>
              {currentEvent.type === 'edit' && (() => {
                try {
                  const payload = JSON.parse(currentEvent.payload_json);
                  return (
                    <>
                      <p><strong>Chars Added:</strong> {payload.charsAdded || 0}</p>
                      <p><strong>Chars Removed:</strong> {payload.charsRemoved || 0}</p>
                      <p><strong>Code Length:</strong> {payload.newLength || 0}</p>
                    </>
                  );
                } catch (e) {
                  return null;
                }
              })()}
              {currentEvent.type === 'paste' && (() => {
                try {
                  const payload = JSON.parse(currentEvent.payload_json);
                  return (
                    <p className={payload.size > 100 ? 'replay-paste-warning' : 'replay-paste-normal'}>
                      <strong>Paste Size:</strong> {payload.size} chars
                      {payload.size > 100 && '  Large paste!'}
                    </p>
                  );
                } catch (e) {
                  return null;
                }
              })()}
            </div>
          )}
        </div>
      </div>

      <div className="replay-editor-pane">
        <CodeEditor
          language={replayData.attempt.assignment?.language || 'python'}
          value={currentCode}  // Use controlled value instead of initialValue
          readOnly={true}
        />
      </div>
    </div>
  );
};

