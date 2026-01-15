import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../utils/apiClient';
import { BATCH_INTERVAL, EVENT_TYPES, MAX_EVENTS_IN_MEMORY, API_BASE_URL } from '../utils/constants';

interface Event {
  t: number;
  seq: number;
  type: string;
  file_path?: string | null;  // NEW: For multi-file project support
  payload_json: string;
}

interface EditChange {
  timestamp: number;
  previousCode: string;
  newCode: string;
}

export const useSessionLogger = (attemptId: number | null) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLogging, setIsLogging] = useState(false);
  const [capturedCount, setCapturedCount] = useState(0);  // NEW: Count captured keystrokes
  const [uploadedCount, setUploadedCount] = useState(0);  // NEW: Count uploaded events
  const sequenceRef = useRef(0);
  const startTimeRef = useRef<number>(Date.now());
  const batchTimerRef = useRef<number | null>(null);
  const pendingEventsRef = useRef<Event[]>([]);
  
  // Track the current attemptId and isLogging to avoid closure issues
  const attemptIdRef = useRef<number | null>(attemptId);
  const isLoggingRef = useRef<boolean>(false);
  
  // Update attemptIdRef whenever attemptId changes
  useEffect(() => {
    console.log(' attemptIdRef updated:', attemptId);
    attemptIdRef.current = attemptId;
  }, [attemptId]);
  
  // Update isLoggingRef whenever isLogging changes
  useEffect(() => {
    console.log(' isLoggingRef updated:', isLogging);
    isLoggingRef.current = isLogging;
  }, [isLogging]);
  
  // Edit tracking with better buffering
  const editBufferRef = useRef<EditChange[]>([]);
  const lastSavedCodeRef = useRef<string>('');
  const editFlushTimerRef = useRef<number | null>(null);
  const EDIT_FLUSH_DELAY = 1000; // Flush edits after 1 second of no typing
  
  // Online/offline handling
  const isOnlineRef = useRef(navigator.onLine);
  const offlineQueueRef = useRef<Event[]>([]);

  // Start logging
  const startLogging = useCallback(() => {
    const currentAttemptId = attemptIdRef.current;
    if (!currentAttemptId) {
      console.warn(' startLogging called but attemptId is null!');
      return;
    }
    setIsLogging(true);
    startTimeRef.current = Date.now();
    sequenceRef.current = 0;
    lastSavedCodeRef.current = '';
    setCapturedCount(0);
    setUploadedCount(0);
    console.log(` Started logging for attempt ${currentAttemptId}`);
    console.log(` Watch for: " Captured edit" (instant), " Flushed" (after 1s), " Uploaded" (every 5s)`);
  }, []); // Remove attemptId from dependencies since we use ref

  // Stop logging
  const stopLogging = useCallback(async () => {
    setIsLogging(false);
    
    // Clear timers
    if (batchTimerRef.current) {
      clearInterval(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    if (editFlushTimerRef.current) {
      clearTimeout(editFlushTimerRef.current);
      editFlushTimerRef.current = null;
    }
    
    // Flush remaining edit changes INLINE (avoid circular dependency)
    if (editBufferRef.current.length > 0) {
      const changes = editBufferRef.current;
      const firstChange = changes[0];
      const lastChange = changes[changes.length - 1];
      
      const previousCode = firstChange.previousCode;
      const newCode = lastChange.newCode;
      
      if (previousCode !== newCode) {
        const charsAdded = Math.max(0, newCode.length - previousCode.length);
        const charsRemoved = Math.max(0, previousCode.length - newCode.length);
        
        const t = (Date.now() - startTimeRef.current) / 1000;
        const seq = sequenceRef.current++;
        
        const event: Event = {
          t,
          seq,
          type: EVENT_TYPES.EDIT,
          file_path: null,  // TODO: Add when multi-file support is implemented
          payload_json: JSON.stringify({
            previousLength: previousCode.length,
            newLength: newCode.length,
            charsAdded,
            charsRemoved,
            changeCount: changes.length,
            duration: lastChange.timestamp - firstChange.timestamp,
            timestamp: lastChange.timestamp,
            fullCode: newCode, // Include full code for final state
          }),
        };
        
        pendingEventsRef.current.push(event);
        editBufferRef.current = [];
      }
    }
    
    // Wait a bit to ensure events are in queue
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const currentAttemptId = attemptIdRef.current;
    
    // Flush remaining events - WAIT for upload to complete
    if (pendingEventsRef.current.length > 0 && currentAttemptId) {
      try {
        await api.logEvents({
          attempt_id: currentAttemptId,
          events: pendingEventsRef.current,
        });
        console.log(` Uploaded ${pendingEventsRef.current.length} events on submit`);
        pendingEventsRef.current = [];
      } catch (error) {
        console.error('Failed to upload events on stop:', error);
      }
    }
    
    // Flush offline queue
    if (offlineQueueRef.current.length > 0 && currentAttemptId) {
      try {
        await api.logEvents({
          attempt_id: currentAttemptId,
          events: offlineQueueRef.current,
        });
        offlineQueueRef.current = [];
      } catch (error) {
        console.error('Failed to upload offline events:', error);
      }
    }
  }, []); // Remove attemptId dependency

  // Log an event
  const logEvent = useCallback((type: string, payload: any, filePath?: string) => {
    const currentAttemptId = attemptIdRef.current;
    const currentIsLogging = isLoggingRef.current;
    
    if (!currentIsLogging || !currentAttemptId) {
      console.log(' logEvent blocked:', { isLogging: currentIsLogging, currentAttemptId, type });
      return;
    }

    const t = (Date.now() - startTimeRef.current) / 1000; // seconds
    const seq = sequenceRef.current++;
    
    const event: Event = {
      t,
      seq,
      type,
      file_path: filePath || null,  // NEW: Support multi-file projects
      payload_json: JSON.stringify(payload),
    };

    // Add to pending queue
    if (isOnlineRef.current) {
      pendingEventsRef.current.push(event);
    } else {
      offlineQueueRef.current.push(event);
    }
    
    // Increment captured count
    setCapturedCount(prev => prev + 1);
    
    // Memory management: Keep only last MAX_EVENTS_IN_MEMORY events in state
    setEvents((prev) => {
      const newEvents = [...prev, event];
      if (newEvents.length > MAX_EVENTS_IN_MEMORY) {
        return newEvents.slice(-MAX_EVENTS_IN_MEMORY);
      }
      return newEvents;
    });
  }, []); // No dependencies needed - we use refs

  // Flush edit buffer to create edit event
  const flushEditBuffer = useCallback(() => {
    if (editBufferRef.current.length === 0) return;
    
    const changes = editBufferRef.current;
    const firstChange = changes[0];
    const lastChange = changes[changes.length - 1];
    
    // Calculate the total diff
    const previousCode = firstChange.previousCode;
    const newCode = lastChange.newCode;
    
    if (previousCode !== newCode) {
      // Calculate character-level changes
      const charsAdded = Math.max(0, newCode.length - previousCode.length);
      const charsRemoved = Math.max(0, previousCode.length - newCode.length);
      
      logEvent(EVENT_TYPES.EDIT, {
        previousLength: previousCode.length,
        newLength: newCode.length,
        charsAdded,
        charsRemoved,
        changeCount: changes.length,
        duration: lastChange.timestamp - firstChange.timestamp,
        timestamp: lastChange.timestamp,
        fullCode: newCode, // Always store full code for accurate replay
        previousSnapshot: previousCode.substring(0, 200), // First 200 chars for quick preview
        newSnapshot: newCode.substring(0, 200)
      }, undefined); // undefined = default file (single-file mode)
      
      console.log(` Flushed ${changes.length} keystrokes  1 edit event (${previousCode.length}  ${newCode.length} chars)`);
      
      lastSavedCodeRef.current = newCode;
    }
    
    // Clear the buffer
    editBufferRef.current = [];
  }, [logEvent]);

  // Batch upload events every BATCH_INTERVAL
  useEffect(() => {
    const currentAttemptId = attemptIdRef.current;
    const currentIsLogging = isLoggingRef.current;
    
    if (!currentIsLogging || !currentAttemptId) return;

    console.log(' Setting up batch timer for attempt:', currentAttemptId);

    batchTimerRef.current = setInterval(() => {
      // Flush edit buffer first
      if (editBufferRef.current.length > 0) {
        flushEditBuffer();
      }
      
      const attemptId = attemptIdRef.current; // Get latest value
      if (!attemptId) return;
      
      // Upload pending events
      if (pendingEventsRef.current.length > 0) {
        const eventsToSend = [...pendingEventsRef.current];
        pendingEventsRef.current = [];

        console.log(` Uploading ${eventsToSend.length} events to server...`);

        api.logEvents({
          attempt_id: attemptId,
          events: eventsToSend,
        }).then(() => {
          console.log(` Successfully uploaded ${eventsToSend.length} events`);
          setUploadedCount(prev => prev + eventsToSend.length);
        }).catch((error) => {
          console.error(' Failed to log events:', error);
          // Put events back for retry (at the front to maintain order)
          pendingEventsRef.current = [...eventsToSend, ...pendingEventsRef.current];
        });
      }
      
      // Try to upload offline queue if back online
      if (isOnlineRef.current && offlineQueueRef.current.length > 0) {
        const offlineEvents = [...offlineQueueRef.current];
        offlineQueueRef.current = [];
        
        api.logEvents({
          attempt_id: attemptId,
          events: offlineEvents,
        }).catch((error) => {
          console.error('Failed to upload offline events:', error);
          offlineQueueRef.current = [...offlineEvents, ...offlineQueueRef.current];
        });
      }
    }, BATCH_INTERVAL);

    return () => {
      if (batchTimerRef.current) {
        clearInterval(batchTimerRef.current);
      }
    };
  }, [isLogging, flushEditBuffer]); // Keep isLogging to trigger setup when it changes

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      console.log('Back online - will sync offline events');
      isOnlineRef.current = true;
    };
    
    const handleOffline = () => {
      console.log('Gone offline - events will be queued');
      isOnlineRef.current = false;
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Visibility change handling - flush when tab becomes hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isLogging) {
        // Tab is hidden, flush everything immediately
        if (editBufferRef.current.length > 0) {
          flushEditBuffer();
        }
        if (pendingEventsRef.current.length > 0 && attemptId) {
          api.logEvents({
            attempt_id: attemptId,
            events: [...pendingEventsRef.current],
          }).catch(console.error);
          pendingEventsRef.current = [];
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLogging, attemptId, flushEditBuffer]);

  // Before unload - flush everything
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isLogging && attemptId) {
        // Flush edits
        if (editBufferRef.current.length > 0) {
          flushEditBuffer();
        }
        
        // Try to send remaining events synchronously
        if (pendingEventsRef.current.length > 0) {
          // Use sendBeacon for reliable sending during page unload
          const data = JSON.stringify({
            attempt_id: attemptId,
            events: pendingEventsRef.current,
          });
          
          navigator.sendBeacon(
            `${API_BASE_URL}/api/events/batch`,
            new Blob([data], { type: 'application/json' })
          );
        }
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isLogging, attemptId, flushEditBuffer]);

  // Specific logging methods
  const logEdit = useCallback((newCode: string) => {
    const currentIsLogging = isLoggingRef.current;
    const currentAttemptId = attemptIdRef.current;
    
    console.log(' logEdit called:', { 
      isLogging: currentIsLogging, 
      attemptId: currentAttemptId, 
      codeLength: newCode.length,
      bufferSize: editBufferRef.current.length 
    });
    
    if (!currentIsLogging) return;
    
    const now = Date.now();
    const previousCode = lastSavedCodeRef.current || '';
    
    // Add to edit buffer (capture every change)
    editBufferRef.current.push({
      timestamp: now,
      previousCode,
      newCode,
    });
    
    console.log(` Captured edit: ${previousCode.length}  ${newCode.length} chars (buffer: ${editBufferRef.current.length})`);
    
    // Update the reference for next change
    lastSavedCodeRef.current = newCode;
    
    // Reset the flush timer (debounce)
    if (editFlushTimerRef.current) {
      clearTimeout(editFlushTimerRef.current);
    }
    
    editFlushTimerRef.current = setTimeout(() => {
      flushEditBuffer();
    }, EDIT_FLUSH_DELAY);
  }, [flushEditBuffer]); // Remove isLogging from dependencies

  const logCursor = useCallback((position: { line: number; column: number }) => {
    logEvent(EVENT_TYPES.CURSOR, position);
  }, [logEvent]);

  const logPaste = useCallback((content: string) => {
    const size = content.length;
    logEvent(EVENT_TYPES.PASTE, { 
      size, 
      isLarge: size > 100,
      preview: content.substring(0, 100) // First 100 chars for analysis
    });
  }, [logEvent]);

  const logRun = useCallback(() => {
    // Flush edits before run to ensure code state is saved
    if (editBufferRef.current.length > 0) {
      flushEditBuffer();
    }
    logEvent(EVENT_TYPES.RUN, { timestamp: Date.now() });
    console.log(` Logged RUN event`);
  }, [logEvent, flushEditBuffer]);

  const logAIPrompt = useCallback((prompt: string) => {
    logEvent(EVENT_TYPES.AI_PROMPT, { prompt });
  }, [logEvent]);

  const logAIResponse = useCallback((response: string) => {
    logEvent(EVENT_TYPES.AI_RESPONSE, { response });
  }, [logEvent]);

  return {
    events,
    isLogging,
    capturedCount,    // NEW: Expose captured count
    uploadedCount,    // NEW: Expose uploaded count
    startLogging,
    stopLogging,
    logEvent,         // NEW: Expose generic logEvent for custom events
    logEdit,
    logCursor,
    logPaste,
    logRun,
    logAIPrompt,
    logAIResponse,
  };
};
