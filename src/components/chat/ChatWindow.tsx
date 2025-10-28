import { useEffect, useRef, useState } from 'react';
import { Message } from './Message';
import { InputBar } from './InputBar';
import { RightPanel } from './RightPanel';
import { useThreadsStore } from '../../store/threads';
import { queryPediatricKnowledge } from '../../lib/nelsonApi';
import { generateId, generateThreadTitle } from '../../lib/utils';
import { Message as MessageType, Source } from '../../types';
import { motion } from 'framer-motion';

export function ChatWindow() {
  const { 
    currentThreadId, 
    getCurrentThread, 
    addMessage, 
    updateMessage,
    updateThread,
  } = useThreadsStore();
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSources, setCurrentSources] = useState<Source[]>([]);
  const [relatedTopics, setRelatedTopics] = useState<string[]>([]);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentThread = getCurrentThread();

  useEffect(() => {
    scrollToBottom();
  }, [currentThread?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (content: string) => {
    if (!currentThreadId) return;

    // Create user message
    const userMessage: MessageType = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    addMessage(currentThreadId, userMessage);

    // Update thread title if this is the first message
    if (currentThread && currentThread.messages.length === 0) {
      updateThread(currentThreadId, { title: generateThreadTitle(content) });
    }

    // Create assistant message placeholder
    const assistantMessageId = generateId();
    const assistantMessage: MessageType = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    addMessage(currentThreadId, assistantMessage);
    setIsStreaming(true);

    // Clear previous results
    setCurrentSources([]);
    setRelatedTopics([]);
    setFollowUpSuggestions([]);

    // Create abort controller for stopping streaming
    abortControllerRef.current = new AbortController();

    try {
      let accumulatedContent = '';

      const response = await queryPediatricKnowledge(
        content,
        (chunk, sources) => {
          if (abortControllerRef.current?.signal.aborted) return;
          
          accumulatedContent += chunk;
          updateMessage(currentThreadId, assistantMessageId, {
            content: accumulatedContent,
          });

          // Add sources when they arrive
          if (sources) {
            setCurrentSources(sources);
            updateMessage(currentThreadId, assistantMessageId, {
              sources,
            });
          }
        }
      );

      if (!abortControllerRef.current?.signal.aborted) {
        // Update with final response data
        updateMessage(currentThreadId, assistantMessageId, {
          content: response.content,
          sources: response.sources,
          isStreaming: false,
        });

        setCurrentSources(response.sources);
        setRelatedTopics(response.relatedTopics);
        setFollowUpSuggestions(response.followUpSuggestions);
      }
    } catch (error) {
      console.error('Error querying:', error);
      updateMessage(currentThreadId, assistantMessageId, {
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        isStreaming: false,
      });
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  const handleFollowUpClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  if (!currentThread) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-2xl px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-text-primary mb-3">
              Nelson-GPT
            </h1>
            <p className="text-lg text-text-secondary mb-2">
              Pediatric Knowledge at Your Fingertips
            </p>
            <p className="text-sm text-text-muted mb-8">
              Connected to Nelson Textbook Database
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => handleSendMessage('What is first-line treatment for Kawasaki disease?')}
                className="p-4 bg-bg-panel hover:bg-bg-input border border-border rounded-lg text-left transition-colors group"
              >
                <div className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                  Kawasaki Disease
                </div>
                <div className="text-xs text-text-secondary mt-1">
                  First-line treatment options
                </div>
              </button>
              <button
                onClick={() => handleSendMessage('How to manage febrile seizures in children?')}
                className="p-4 bg-bg-panel hover:bg-bg-input border border-border rounded-lg text-left transition-colors group"
              >
                <div className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                  Febrile Seizures
                </div>
                <div className="text-xs text-text-secondary mt-1">
                  Management guidelines
                </div>
              </button>
              <button
                onClick={() => handleSendMessage('Recommended immunization schedule for toddlers?')}
                className="p-4 bg-bg-panel hover:bg-bg-input border border-border rounded-lg text-left transition-colors group"
              >
                <div className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                  Immunization Schedule
                </div>
                <div className="text-xs text-text-secondary mt-1">
                  Toddler vaccine timeline
                </div>
              </button>
              <button
                onClick={() => handleSendMessage('What are normal developmental milestones for a 2-year-old?')}
                className="p-4 bg-bg-panel hover:bg-bg-input border border-border rounded-lg text-left transition-colors group"
              >
                <div className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                  Development
                </div>
                <div className="text-xs text-text-secondary mt-1">
                  Milestones for 2-year-olds
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {currentThread.messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input bar */}
        <InputBar
          onSend={handleSendMessage}
          isStreaming={isStreaming}
          onStopStreaming={handleStopStreaming}
        />
      </div>

      {/* Right panel */}
      <RightPanel
        sources={currentSources}
        relatedTopics={relatedTopics}
        followUpSuggestions={followUpSuggestions}
        onFollowUpClick={handleFollowUpClick}
      />
    </>
  );
}