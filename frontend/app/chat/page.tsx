'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import ConversationSidebar from '@/components/ConversationSidebar';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Stats {
  todayRequests: number;
  tier: string;
  tokensUsed: number;
  tokensLimit: number;
  tokensRemaining: number;
  tokensPercentUsed: string;
}

export default function ChatPage() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversationLimitReached, setConversationLimitReached] = useState(false);
  const [conversationTokens, setConversationTokens] = useState(0);
  const [maxTokens, setMaxTokens] = useState(150000); // Default, updated from backend
  const [refreshSidebar, setRefreshSidebar] = useState(0);
  const [isConversationArchived, setIsConversationArchived] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load stats on mount
  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  // Debug: Log stats state
  useEffect(() => {
    console.log('Stats state:', stats);
  }, [stats]);

  // Debug: Log archived state
  useEffect(() => {
    console.log('IS ARCHIVED:', isConversationArchived);
  }, [isConversationArchived]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadStats() {
    try {
      const response = await api.get('/api/chat/stats');
      setStats(response.data.stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  // Load conversation when selected
  async function loadConversation(conversationId: string) {
    try {
      const response = await api.get(`/api/conversations/${conversationId}`);

      console.log('API response for conversation:', conversationId, response.data);

      const loadedMessages: Message[] = [];
      for (const msg of response.data.messages) {
        // Only add user message if it's not empty (e.g., skip for summary-only entries)
        if (msg.userMessage) {
          loadedMessages.push({
            id: msg.id + '-user',
            role: 'user',
            content: msg.userMessage,
            timestamp: new Date(msg.createdAt),
          });
        }
        if (msg.assistantResponse) {
          loadedMessages.push({
            id: msg.id + '-assistant',
            role: 'assistant',
            content: msg.assistantResponse,
            timestamp: new Date(msg.createdAt),
          });
        }
      }

      setMessages(loadedMessages);
      setCurrentConversationId(conversationId);

      // Check if archived (archivedAt is not null)
      const isArchived = !!response.data.conversation?.archivedAt;
      setIsConversationArchived(isArchived);

      // If archived, show the "Summarize & Continue" button
      if (isArchived) {
        setConversationLimitReached(true);
        setConversationTokens(response.data.conversation?.totalTokens || 0);
        setMaxTokens(response.data.maxTokens || 150000); // Use actual limit from backend
      } else {
        setConversationLimitReached(false);
      }

      setError('');

      console.log('Loaded conversation:', {
        id: conversationId,
        archivedAt: response.data.conversation?.archivedAt,
        isArchived,
        totalTokens: response.data.conversation?.totalTokens
      });
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setError('Failed to load conversation');
    }
  }

  function startNewConversation() {
    setMessages([]);
    setCurrentConversationId(null);
    setConversationLimitReached(false);
    setIsConversationArchived(false);
    setError('');
  }

  // Handle summarization
  async function handleSummarizeAndContinue() {
    if (!currentConversationId) return;

    setLoading(true);
    setError('');

    try {
      const response = await api.post(
        `/api/conversations/${currentConversationId}/summarize-and-continue`
      );

      // Reset limit state
      setConversationLimitReached(false);
      setConversationTokens(0);
      setError('');

      // Load the new conversation (which includes the summary as first message)
      // loadConversation will set currentConversationId
      await loadConversation(response.data.newConversationId);

      // Refresh sidebar to show new conversation
      setTimeout(() => {
        setRefreshSidebar(prev => prev + 1);
      }, 500);

      // Success notification
      alert('Conversation summarized! Continue chatting here.');
    } catch (err) {
      setError('Failed to summarize conversation');
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const payload: { message: string; conversationId?: string } = {
        message: input,
      };

      // Only include conversationId if it exists
      if (currentConversationId) {
        payload.conversationId = currentConversationId;
      }

      const response = await api.post('/api/chat', payload);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update conversation ID if it's a new conversation
      if (!currentConversationId && response.data.conversationId) {
        setCurrentConversationId(response.data.conversationId);
        // Trigger sidebar refresh after a short delay to allow title generation
        setTimeout(() => {
          setRefreshSidebar(prev => prev + 1);
        }, 500);
      }

      // Check if conversation limit reached AFTER this message
      if (response.data.conversationLimitReached) {
        setConversationLimitReached(true);
        setConversationTokens(response.data.conversationTokens);
        setMaxTokens(response.data.maxTokens);
      }

      // Reload stats
      if (user) {
        loadStats();
      }
    } catch (err: any) {
      // Check for conversation limit error (already exceeded)
      if (err.response?.data?.error === 'conversation_limit_reached') {
        setConversationLimitReached(true);
        setConversationTokens(err.response.data.conversationTokens);
        setMaxTokens(err.response.data.maxTokens || 150000);
        return;
      }

      setError(err.response?.data?.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - only show for authenticated users */}
      {user && (
        <ConversationSidebar
          currentConversationId={currentConversationId}
          onSelectConversation={loadConversation}
          onNewConversation={startNewConversation}
          refreshTrigger={refreshSidebar}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MTG Agent</h1>
            {user && (
              <p className="text-sm text-gray-600">
                {user.email} ({user.tier} tier)
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            {stats && user && (
              <div
                className="text-sm cursor-help"
                title={`${stats.tokensUsed?.toLocaleString() || 0} / ${stats.tokensLimit?.toLocaleString() || 0} tokens used today\nResets at midnight UTC`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Daily Tokens:</span>
                  <span className={`font-medium ${
                    parseFloat(stats.tokensPercentUsed || '0') >= 90
                      ? 'text-red-600'
                      : parseFloat(stats.tokensPercentUsed || '0') >= 75
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}>
                    {stats.tokensPercentUsed || '0'}%
                  </span>
                </div>
              </div>
            )}

            {user ? (
              <button
                onClick={logout}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Logout
              </button>
            ) : (
              <a
                href="/login"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Sign in
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <h2 className="text-xl font-semibold mb-2">Welcome to MTG Agent!</h2>
              <p>Ask me anything about Magic: The Gathering.</p>
              {!user && (
                <p className="mt-2 text-sm">
                  Anonymous users get 3 messages per day. <a href="/register" className="text-blue-600">Register</a> for 50/day!
                </p>
              )}
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-2xl rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-900 shadow'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-lg px-4 py-3 shadow">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

        {/* Error - hide if conversation limit is the issue */}
        {error && !conversationLimitReached && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200">
            <div className="max-w-3xl mx-auto">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Conversation Limit Banner */}
        {conversationLimitReached && conversationTokens !== undefined && maxTokens !== undefined && (
          <div className="border-t bg-yellow-50 border-yellow-200">
            <div className="max-w-3xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800">
                    Conversation Limit Reached ({conversationTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens)
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    This conversation is too long. Summarize to continue chatting.
                  </p>
                </div>
                <button
                  onClick={handleSummarizeAndContinue}
                  disabled={loading}
                  className="ml-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 text-sm font-medium"
                >
                  Summarize & Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {isConversationArchived ? (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-2">This conversation is archived and read-only</p>
              <button
                onClick={startNewConversation}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Start New Conversation
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about MTG rules, cards, strategies..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                  maxLength={2000}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </form>
              <p className="mt-1 text-xs text-gray-500 text-right">
                {input.length}/2000 characters
              </p>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
