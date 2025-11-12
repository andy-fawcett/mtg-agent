'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Stats {
  todayRequests: number;
  totalRequests: number;
  todayCostCents: number;
}

export default function ChatPage() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load stats on mount
  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

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
      const response = await api.post('/api/chat', { message: input });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Reload stats
      if (user) {
        loadStats();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
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
            {stats && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">{stats.todayRequests}</span> requests today
                {stats.todayCostCents > 0 && (
                  <span className="ml-2">(${(stats.todayCostCents / 100).toFixed(2)})</span>
                )}
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

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <div className="max-w-3xl mx-auto">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4">
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
        </div>
      </div>
    </div>
  );
}
