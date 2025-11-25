'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Conversation {
  id: string;
  title: string | null;
  lastMessageAt: string;
  messageCount: number;
  lastMessage: string | null;
  archivedAt: string | null;
}

interface ConversationSidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  refreshTrigger?: number;
}

export default function ConversationSidebar({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  refreshTrigger,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  // Reload conversations when refreshTrigger changes (new conversation created)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      loadConversations();
    }
  }, [refreshTrigger]);

  async function loadConversations() {
    try {
      const response = await api.get('/api/conversations');
      setConversations(response.data.conversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();

    if (!confirm('Delete this conversation?')) return;

    try {
      await api.delete(`/api/conversations/${id}`);
      setConversations(conversations.filter(c => c.id !== id));

      // If deleting current conversation, create new one
      if (id === currentConversationId) {
        onNewConversation();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert('Failed to delete conversation');
    }
  }

  if (loading) {
    return (
      <div className="w-64 bg-gray-900 text-white p-4">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <button
          onClick={onNewConversation}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
        >
          + New Chat
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-400">
            No conversations yet
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`group relative px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-800 ${
                  conv.id === currentConversationId ? 'bg-gray-800' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-medium truncate">
                        {conv.title || 'New conversation'}
                      </p>
                      {conv.archivedAt && (
                        <svg className="w-3 h-3 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" title="Archived - reached token limit">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className="text-xs text-gray-400 truncate mt-1">
                        {conv.lastMessage}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}
                      {conv.archivedAt && <span className="text-yellow-500"> • Archived</span>}
                    </p>
                  </div>

                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 ml-2 text-gray-400 hover:text-red-400"
                    title="Delete conversation"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
