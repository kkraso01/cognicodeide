import { useState, useCallback } from 'react';
import { AI_MODEL } from '../utils/constants';
import { api } from '../utils/apiClient';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const useAIInteraction = (attemptId: number | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (userMessage: string, model: string = AI_MODEL) => {
    if (!attemptId) {
      setError('No active attempt');
      return null;
    }

    setIsLoading(true);
    setError(null);

    // Add user message
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    try {
      // Call the backend AI API endpoint (logs interaction to database)
      const data = await api.chat({
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        model: model.replace(':latest', '').replace(':4b', '').replace(':1b', ''), // Strip version suffix
        temperature: 0.7,
      }, attemptId);
      
      // Extract assistant response from the API response
      const assistantMessage = data.choices?.[0]?.message?.content || '';
      
      if (!assistantMessage) {
        throw new Error('No response content received from AI');
      }
      
      // Add assistant message
      setMessages([...newMessages, { role: 'assistant', content: assistantMessage }]);
      setIsLoading(false);
      
      return assistantMessage;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to communicate with AI';
      setError(errorMessage);
      setIsLoading(false);
      return null;
    }
  }, [messages, attemptId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
};
