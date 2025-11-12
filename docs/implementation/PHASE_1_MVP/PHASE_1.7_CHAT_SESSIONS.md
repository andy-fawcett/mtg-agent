# Phase 1.7: Chat Sessions & Conversation History

**Status:** 🚧 In Progress - Backend Complete (95%), Frontend Pending
**Duration Estimate:** 10-12 hours (updated with token tracking and summarization)
**Time Spent:** ~8 hours (backend implementation)
**Prerequisites:** Phase 1.6 complete (frontend application working)
**Dependencies:** Conversation management, message persistence, token tracking

## Objectives

Implement session-based chat conversations with persistent history, token-based rate limiting, and automatic conversation summarization.

- Create conversations table for organizing chats
- Allow users to create multiple conversation threads
- Load and display full conversation history to Claude (context window)
- Sidebar with conversation list
- Ability to switch between conversations
- Delete/archive old conversations
- Auto-generate conversation titles from first message
- **NEW: Track total tokens per user per day (shared across conversations)**
- **NEW: Track total tokens per conversation**
- **NEW: Enforce 150k token limit per conversation**
- **NEW: One-click "Summarize & Continue" when conversation reaches 150k tokens**
- **NEW: Automatic conversation archival and new conversation creation with summary**

---

## Task 1.7.1: Backend - Conversations Table

**Estimated Time:** 45 minutes

### Objectives

Add database support for conversation sessions.

### Steps

**Create `backend/migrations/005_add_conversations.sql`:**

```sql
-- ======================
-- Conversations Table
-- ======================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Conversation metadata
  title VARCHAR(255),

  -- Token tracking (NEW)
  total_tokens INTEGER DEFAULT 0,
  summary_context TEXT,  -- Stores summary from previous conversation if continued

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP DEFAULT NOW(),

  -- Soft delete / archive
  deleted_at TIMESTAMP,
  archived_at TIMESTAMP  -- NEW: Archived when summarized and continued
);

-- Indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_updated ON conversations(user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_last_message ON conversations(user_id, last_message_at DESC) WHERE deleted_at IS NULL;

-- ======================
-- Update Chat Logs Table
-- ======================

-- Add conversation_id column
ALTER TABLE chat_logs
ADD COLUMN conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;

-- Create index for conversation lookups
CREATE INDEX idx_chat_logs_conversation ON chat_logs(conversation_id, created_at);

-- Add columns to store actual message content
ALTER TABLE chat_logs
ADD COLUMN user_message TEXT NOT NULL DEFAULT '',
ADD COLUMN assistant_response TEXT;

-- Remove default after adding column (for future inserts)
ALTER TABLE chat_logs
ALTER COLUMN user_message DROP DEFAULT;

-- Update trigger to update conversation's last_message_at
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_timestamp
AFTER INSERT ON chat_logs
FOR EACH ROW
WHEN (NEW.conversation_id IS NOT NULL)
EXECUTE FUNCTION update_conversation_timestamp();

-- ======================
-- User Daily Token Usage (NEW)
-- ======================
CREATE TABLE IF NOT EXISTS user_daily_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Token tracking (input + output combined)
  total_tokens_used INTEGER DEFAULT 0,
  request_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- One record per user per day
  UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX idx_user_daily_tokens_user ON user_daily_tokens(user_id, date DESC);
CREATE INDEX idx_user_daily_tokens_date ON user_daily_tokens(date);

-- Trigger to update conversation total_tokens on chat_log insert
CREATE OR REPLACE FUNCTION update_conversation_tokens()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET total_tokens = total_tokens + NEW.tokens_used
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_tokens
AFTER INSERT ON chat_logs
FOR EACH ROW
WHEN (NEW.conversation_id IS NOT NULL AND NEW.tokens_used IS NOT NULL)
EXECUTE FUNCTION update_conversation_tokens();
```

**Run migration:**

```bash
cd backend
psql $DATABASE_URL -f migrations/005_add_conversations.sql
```

### Verification

```bash
# Verify tables exist
psql $DATABASE_URL -c "\d conversations"
psql $DATABASE_URL -c "\d chat_logs"

# Should show conversation_id, user_message, assistant_response columns
```

### Success Criteria

- [ ] Conversations table created
- [ ] chat_logs updated with conversation_id
- [ ] chat_logs stores actual message content
- [ ] Indexes created
- [ ] Trigger updates conversation timestamps

---

## Task 1.7.2: Backend - Conversation Models & API

**Estimated Time:** 120 minutes

### Objectives

Create conversation management endpoints.

### Steps

**Create `backend/src/models/Conversation.ts`:**

```typescript
import { pool } from '../db/client';

export interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  deletedAt: Date | null;
}

export interface ConversationWithStats extends Conversation {
  messageCount: number;
  lastMessage: string | null;
}

export class ConversationModel {
  /**
   * Create a new conversation
   */
  static async create(userId: string, title?: string): Promise<Conversation> {
    const result = await pool.query(
      `INSERT INTO conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, title || null]
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Get all conversations for a user
   */
  static async getByUserId(userId: string): Promise<ConversationWithStats[]> {
    const result = await pool.query(
      `SELECT
        c.*,
        COUNT(cl.id) as message_count,
        (SELECT user_message FROM chat_logs
         WHERE conversation_id = c.id
         ORDER BY created_at DESC
         LIMIT 1) as last_message
       FROM conversations c
       LEFT JOIN chat_logs cl ON cl.conversation_id = c.id
       WHERE c.user_id = $1 AND c.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY c.last_message_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      ...this.mapRow(row),
      messageCount: parseInt(row.message_count),
      lastMessage: row.last_message,
    }));
  }

  /**
   * Get a specific conversation
   */
  static async getById(id: string, userId: string): Promise<Conversation | null> {
    const result = await pool.query(
      `SELECT * FROM conversations
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Update conversation title
   */
  static async updateTitle(id: string, userId: string, title: string): Promise<void> {
    await pool.query(
      `UPDATE conversations
       SET title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL`,
      [title, id, userId]
    );
  }

  /**
   * Soft delete conversation
   */
  static async delete(id: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE conversations
       SET deleted_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
  }

  /**
   * Generate title from first message
   */
  static async generateTitle(conversationId: string, firstMessage: string): Promise<string> {
    // Simple title generation: take first 50 chars of message
    const title = firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');
    return title;
  }

  private static mapRow(row: any): Conversation {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: row.last_message_at,
      deletedAt: row.deleted_at,
    };
  }
}
```

**Update `backend/src/models/ChatLog.ts` to include message content:**

```typescript
// Add to ChatLog interface
export interface ChatLog {
  // ... existing fields ...
  conversationId: string | null;
  userMessage: string;
  assistantResponse: string | null;
}

// Update create method
static async create(data: {
  userId: string | null;
  conversationId: string | null;
  userMessage: string;
  assistantResponse: string | null;
  messageLength: number;
  responseLength: number | null;
  inputTokens: number;
  outputTokens: number;
  tokensUsed: number;
  actualCostCents: number;
  success: boolean;
  errorMessage?: string;
}): Promise<ChatLog> {
  const result = await pool.query(
    `INSERT INTO chat_logs (
      user_id, conversation_id, user_message, assistant_response,
      message_length, response_length,
      input_tokens, output_tokens, tokens_used,
      actual_cost_cents, success, error_message
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      data.userId,
      data.conversationId,
      data.userMessage,
      data.assistantResponse,
      data.messageLength,
      data.responseLength,
      data.inputTokens,
      data.outputTokens,
      data.tokensUsed,
      data.actualCostCents,
      data.success,
      data.errorMessage || null,
    ]
  );

  return this.mapRow(result.rows[0]);
}

// Add method to get messages in a conversation
static async getByConversationId(conversationId: string, limit: number = 100): Promise<ChatLog[]> {
  const result = await pool.query(
    `SELECT * FROM chat_logs
     WHERE conversation_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [conversationId, limit]
  );

  return result.rows.map(this.mapRow);
}
```

**Create `backend/src/routes/conversations.ts`:**

```typescript
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { ConversationModel } from '../models/Conversation';
import { ChatLogModel } from '../models/ChatLog';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/conversations
 * List all conversations for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const conversations = await ConversationModel.getByUserId(req.user!.id);

    res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
    });
  }
});

/**
 * POST /api/conversations
 * Create a new conversation
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title } = req.body;

    const conversation = await ConversationModel.create(req.user!.id, title);

    res.status(201).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('Failed to create conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create conversation',
    });
  }
});

/**
 * GET /api/conversations/:id
 * Get a specific conversation with all messages
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const conversation = await ConversationModel.getById(id, req.user!.id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Get all messages in the conversation
    const messages = await ChatLogModel.getByConversationId(id);

    res.json({
      success: true,
      conversation,
      messages: messages.map(msg => ({
        id: msg.id,
        userMessage: msg.userMessage,
        assistantResponse: msg.assistantResponse,
        createdAt: msg.createdAt,
        tokensUsed: msg.tokensUsed,
        actualCostCents: msg.actualCostCents,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation',
    });
  }
});

/**
 * PATCH /api/conversations/:id
 * Update conversation title
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }

    await ConversationModel.updateTitle(id, req.user!.id, title);

    res.json({
      success: true,
      message: 'Title updated',
    });
  } catch (error) {
    console.error('Failed to update conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update conversation',
    });
  }
});

/**
 * DELETE /api/conversations/:id
 * Delete a conversation
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await ConversationModel.delete(id, req.user!.id);

    res.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation',
    });
  }
});

export default router;
```

**Update `backend/src/routes/chat.ts` to support conversations:**

```typescript
// Update POST /api/chat endpoint to accept conversationId
router.post(
  '/',
  ipRateLimit,
  optionalAuth,
  userRateLimit,
  budgetCheck,
  validate(ChatSchema),
  async (req: Request, res: Response) => {
    try {
      const { message, conversationId } = req.body;

      const userId = req.user?.id;
      const userTier = req.user?.tier || 'anonymous';

      // If conversationId provided, verify it belongs to user
      if (conversationId && userId) {
        const conversation = await ConversationModel.getById(conversationId, userId);
        if (!conversation) {
          return res.status(404).json({
            error: 'Conversation not found',
          });
        }
      }

      // Call chat service
      const response = await ChatService.chat({
        message,
        userId,
        userTier,
        conversationId,
      });

      res.status(200).json({
        response: response.response,
        conversationId: response.conversationId,
        metadata: {
          tokensUsed: response.tokensUsed,
          model: response.model,
          costCents: response.costCents,
        },
      });
    } catch (error: any) {
      // ... error handling ...
    }
  }
);
```

**Update `backend/src/services/chatService.ts`:**

```typescript
// Update chat method to handle conversations
static async chat(params: {
  message: string;
  userId?: string;
  userTier: string;
  conversationId?: string;
}): Promise<{
  response: string;
  conversationId: string | null;
  tokensUsed: number;
  model: string;
  costCents: number;
}> {
  // ... existing jailbreak detection ...

  let conversationId = params.conversationId || null;

  // If user is authenticated and no conversation provided, create one
  if (params.userId && !conversationId) {
    const conversation = await ConversationModel.create(params.userId);
    conversationId = conversation.id;

    // Generate title from first message
    const title = await ConversationModel.generateTitle(conversationId, params.message);
    await ConversationModel.updateTitle(conversationId, params.userId, title);
  }

  // ... existing Anthropic API call ...

  // Log to database with conversation
  await ChatLogModel.create({
    userId: params.userId || null,
    conversationId,
    userMessage: params.message,
    assistantResponse: responseText,
    messageLength: params.message.length,
    responseLength: responseText.length,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    tokensUsed: usage.input_tokens + usage.output_tokens,
    actualCostCents: costCents,
    success: true,
  });

  return {
    response: responseText,
    conversationId,
    tokensUsed: usage.input_tokens + usage.output_tokens,
    model: this.MODEL,
    costCents,
  };
}
```

**Update `backend/src/index.ts` to include conversation routes:**

```typescript
import conversationRoutes from './routes/conversations';

// ... existing code ...

// Conversation routes (protected)
app.use('/api/conversations', conversationRoutes);
```

### Verification

```bash
# Restart backend
pnpm run dev

# Test creating conversation
curl -X POST http://localhost:3000/api/conversations \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -H "Content-Type: application/json"

# Test listing conversations
curl http://localhost:3000/api/conversations \
  -H "Cookie: connect.sid=YOUR_SESSION"
```

### Success Criteria

- [ ] Conversation model created
- [ ] API endpoints working
- [ ] Can create conversations
- [ ] Can list conversations
- [ ] Can get conversation messages
- [ ] Can update conversation title
- [ ] Can delete conversations

---

## Task 1.7.3: Frontend - Conversation Sidebar

**Estimated Time:** 150 minutes

### Objectives

Add sidebar UI for managing conversations.

### Steps

**Create `frontend/components/ConversationSidebar.tsx`:**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Conversation {
  id: string;
  title: string | null;
  lastMessageAt: string;
  messageCount: number;
  lastMessage: string | null;
}

interface ConversationSidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export default function ConversationSidebar({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

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
                    <p className="text-sm font-medium truncate">
                      {conv.title || 'New conversation'}
                    </p>
                    {conv.lastMessage && (
                      <p className="text-xs text-gray-400 truncate mt-1">
                        {conv.lastMessage}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}
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
```

**Update `frontend/app/chat/page.tsx` to use sidebar and load conversations:**

```typescript
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

export default function ChatPage() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversation when selected
  async function loadConversation(conversationId: string) {
    try {
      const response = await api.get(`/api/conversations/${conversationId}`);

      const loadedMessages: Message[] = [];
      for (const msg of response.data.messages) {
        loadedMessages.push({
          id: msg.id + '-user',
          role: 'user',
          content: msg.userMessage,
          timestamp: new Date(msg.createdAt),
        });
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
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setError('Failed to load conversation');
    }
  }

  function startNewConversation() {
    setMessages([]);
    setCurrentConversationId(null);
    setError('');
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
      const response = await api.post('/api/chat', {
        message: input,
        conversationId: currentConversationId,
      });

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
      }
    } catch (err: any) {
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
    </div>
  );
}
```

### Success Criteria

- [ ] Sidebar displays conversations
- [ ] Can create new conversation
- [ ] Can switch between conversations
- [ ] Messages load correctly
- [ ] Can delete conversations
- [ ] Sidebar only shows for authenticated users

---

## Task 1.7.4: Token Tracking & Conversation Limits

**Estimated Time:** 90 minutes

### Objectives

Implement token-based rate limiting and conversation length management.

### Steps

**Create `backend/src/models/UserDailyTokens.ts`:**

```typescript
import { pool } from '../db/client';

export interface UserDailyTokens {
  id: string;
  userId: string;
  date: Date;
  totalTokensUsed: number;
  requestCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class UserDailyTokensModel {
  /**
   * Get or create today's token usage for user
   */
  static async getOrCreateToday(userId: string): Promise<UserDailyTokens> {
    const result = await pool.query(
      `INSERT INTO user_daily_tokens (user_id, date, total_tokens_used, request_count)
       VALUES ($1, CURRENT_DATE, 0, 0)
       ON CONFLICT (user_id, date)
       DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [userId]
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Add tokens to user's daily total
   */
  static async addTokens(userId: string, tokens: number): Promise<void> {
    await pool.query(
      `INSERT INTO user_daily_tokens (user_id, date, total_tokens_used, request_count)
       VALUES ($1, CURRENT_DATE, $2, 1)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         total_tokens_used = user_daily_tokens.total_tokens_used + $2,
         request_count = user_daily_tokens.request_count + 1,
         updated_at = NOW()`,
      [userId, tokens]
    );
  }

  /**
   * Get user's token usage for today
   */
  static async getTodayUsage(userId: string): Promise<number> {
    const result = await pool.query(
      `SELECT total_tokens_used
       FROM user_daily_tokens
       WHERE user_id = $1 AND date = CURRENT_DATE`,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0].total_tokens_used : 0;
  }

  private static mapRow(row: any): UserDailyTokens {
    return {
      id: row.id,
      userId: row.user_id,
      date: row.date,
      totalTokensUsed: row.total_tokens_used,
      requestCount: row.request_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
```

**Update `backend/src/middleware/rateLimit.ts` to use token-based limits:**

```typescript
// Add to TierLimits interface
interface TierLimits {
  tokensPerDay: number;        // NEW: Total tokens allowed per day
  maxOutputTokens: number;     // RENAMED from maxTokens
}

// Update getTierLimits
function getTierLimits(tier: string): TierLimits {
  const limits: Record<string, TierLimits> = {
    anonymous: {
      tokensPerDay: 10_000,
      maxOutputTokens: 1_000,
    },
    free: {
      tokensPerDay: 100_000,
      maxOutputTokens: 2_000,
    },
    premium: {
      tokensPerDay: 1_000_000,
      maxOutputTokens: 4_000,
    },
    enterprise: {
      tokensPerDay: 10_000_000,
      maxOutputTokens: 8_000,
    },
  };

  return limits[tier] || limits.free;
}

// Add new middleware: tokenBudgetCheck
export async function tokenBudgetCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Skip for anonymous users (handled by request count limit)
    if (!req.user) {
      next();
      return;
    }

    const tier = req.user.tier;
    const limits = getTierLimits(tier);

    // Get user's tokens used today
    const { UserDailyTokensModel } = await import('../models/UserDailyTokens');
    const tokensUsed = await UserDailyTokensModel.getTodayUsage(req.user.id);

    // Estimate tokens for this request (rough: message chars / 4)
    const messageLength = req.body.message?.length || 0;
    const estimatedInputTokens = Math.ceil(messageLength / 4);
    const estimatedTotalTokens = estimatedInputTokens + limits.maxOutputTokens;

    // Check if user would exceed daily limit
    if (tokensUsed + estimatedTotalTokens > limits.tokensPerDay) {
      const remaining = Math.max(0, limits.tokensPerDay - tokensUsed);

      res.status(429).json({
        error: 'Daily token limit exceeded',
        message: `You've used ${tokensUsed.toLocaleString()} of your ${limits.tokensPerDay.toLocaleString()} daily tokens. Resets at midnight UTC.`,
        tokensUsed,
        tokensLimit: limits.tokensPerDay,
        tokensRemaining: remaining,
      });
      return;
    }

    // Add info to response headers
    res.set({
      'X-Tokens-Limit': String(limits.tokensPerDay),
      'X-Tokens-Used': String(tokensUsed),
      'X-Tokens-Remaining': String(limits.tokensPerDay - tokensUsed),
    });

    next();
  } catch (error) {
    console.error('Token budget check error:', error);
    next(error);
  }
}
```

**Add conversation token limit constant:**

```typescript
// backend/src/config/limits.ts (NEW FILE)
export const CONVERSATION_LIMITS = {
  MAX_TOKENS: 150_000,           // Hard limit per conversation
  WARNING_TOKENS: 120_000,       // Soft warning (not used - per your requirements)
};
```

### Verification

```bash
# Test token tracking
curl -X POST http://localhost:3000/api/chat \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"message":"Test message"}'

# Check response headers
# X-Tokens-Limit, X-Tokens-Used, X-Tokens-Remaining
```

### Success Criteria

- [ ] UserDailyTokens model created
- [ ] Token tracking middleware working
- [ ] Daily token limits enforced per tier
- [ ] Response headers show token usage
- [ ] Conversation token tracking automatic (via trigger)

---

## Task 1.7.5: Summarize & Continue Feature

**Estimated Time:** 120 minutes

### Objectives

Implement one-click conversation summarization when hitting 150k token limit.

### Steps

**Add to `backend/src/routes/conversations.ts`:**

```typescript
/**
 * POST /api/conversations/:id/summarize-and-continue
 * Summarize current conversation and create new one with summary context
 */
router.post('/:id/summarize-and-continue', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get conversation
    const conversation = await ConversationModel.getById(id, req.user!.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Get all messages
    const messages = await ChatLogModel.getByConversationId(id);

    if (messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot summarize empty conversation',
      });
    }

    // Build conversation history for Claude
    const conversationHistory = messages.map(msg => [
      { role: 'user' as const, content: msg.userMessage },
      { role: 'assistant' as const, content: msg.assistantResponse || '' },
    ]).flat().filter(msg => msg.content);

    // Summarization prompt (preset, not user-modifiable)
    const SUMMARIZATION_PROMPT = `Please provide a concise summary of this Magic: The Gathering conversation, including:
- Key topics discussed
- Important cards, rules, or strategies mentioned
- Any decisions or conclusions reached
- Relevant context needed to continue the conversation

Keep the summary under 500 tokens.`;

    // Call Claude to summarize
    const anthropic = getAnthropicClient();
    const summaryResponse = await anthropic.messages.create({
      model: CLAUDE_CONFIG.model,
      max_tokens: 1000,
      system: MTG_SYSTEM_PROMPT,
      messages: [
        ...conversationHistory,
        { role: 'user', content: SUMMARIZATION_PROMPT }
      ],
    });

    const summary = summaryResponse.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as any).text)
      .join('\n');

    // Create new conversation with summary
    const newConversation = await ConversationModel.create(
      req.user!.id,
      `Continued: ${conversation.title || 'Conversation'}`
    );

    // Store summary context
    await ConversationModel.setSummaryContext(newConversation.id, summary);

    // Archive old conversation
    await ConversationModel.archive(id);

    res.json({
      success: true,
      newConversationId: newConversation.id,
      summary,
      message: 'Conversation summarized successfully',
    });

  } catch (error) {
    console.error('Failed to summarize conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to summarize conversation',
    });
  }
});
```

**Add methods to ConversationModel:**

```typescript
/**
 * Set summary context for continued conversation
 */
static async setSummaryContext(id: string, summary: string): Promise<void> {
  await pool.query(
    `UPDATE conversations
     SET summary_context = $1, updated_at = NOW()
     WHERE id = $2`,
    [summary, id]
  );
}

/**
 * Archive conversation (soft archive, different from delete)
 */
static async archive(id: string): Promise<void> {
  await pool.query(
    `UPDATE conversations
     SET archived_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

/**
 * Get conversation with token count check
 */
static async getByIdWithTokenCheck(id: string, userId: string): Promise<{
  conversation: Conversation;
  canContinue: boolean;
  requiresSummary: boolean;
}> {
  const conversation = await this.getById(id, userId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const { CONVERSATION_LIMITS } = await import('../config/limits');

  return {
    conversation,
    canContinue: conversation.totalTokens < CONVERSATION_LIMITS.MAX_TOKENS,
    requiresSummary: conversation.totalTokens >= CONVERSATION_LIMITS.MAX_TOKENS,
  };
}
```

**Update chat endpoint to check conversation limits:**

```typescript
// In POST /api/chat endpoint, before calling ChatService

if (conversationId && userId) {
  const { ConversationModel } = await import('../models/Conversation');
  const { CONVERSATION_LIMITS } = await import('../config/limits');

  const conversation = await ConversationModel.getById(conversationId, userId);

  if (!conversation) {
    return res.status(404).json({
      error: 'Conversation not found',
    });
  }

  // Check if conversation has hit token limit
  if (conversation.totalTokens >= CONVERSATION_LIMITS.MAX_TOKENS) {
    return res.status(400).json({
      error: 'conversation_limit_reached',
      message: 'This conversation has reached its maximum length.',
      conversationTokens: conversation.totalTokens,
      maxTokens: CONVERSATION_LIMITS.MAX_TOKENS,
      action: {
        type: 'summarize_required',
        endpoint: `/api/conversations/${conversationId}/summarize-and-continue`,
        buttonText: 'Summarize & Start New Chat',
      },
    });
  }
}
```

### Verification

```bash
# Create long conversation (simulate)
# ... send many messages ...

# Try to send message when over limit
# Should get conversation_limit_reached error

# Summarize and continue
curl -X POST http://localhost:3000/api/conversations/{id}/summarize-and-continue \
  -H "Cookie: connect.sid=YOUR_SESSION"
```

### Success Criteria

- [ ] Summarize endpoint working
- [ ] Summary generated by Claude
- [ ] New conversation created with summary context
- [ ] Old conversation archived
- [ ] Chat endpoint blocks messages on 150k limit
- [ ] Error response includes summarization action

---

## Task 1.7.6: Frontend - Summarization UI

**Estimated Time:** 60 minutes

### Objectives

Add UI to handle conversation length limits and one-click summarization.

### Steps

**Update `frontend/app/chat/page.tsx`:**

```typescript
// Add state for conversation limit error
const [conversationLimitReached, setConversationLimitReached] = useState(false);
const [conversationTokens, setConversationTokens] = useState(0);

// Update sendMessage to handle limit
async function sendMessage(e: React.FormEvent) {
  e.preventDefault();
  if (!input.trim() || loading) return;

  // ... existing code ...

  try {
    const response = await api.post('/api/chat', {
      message: input,
      conversationId: currentConversationId,
    });

    // ... handle success ...

  } catch (err: any) {
    // Check for conversation limit error
    if (err.response?.data?.error === 'conversation_limit_reached') {
      setConversationLimitReached(true);
      setConversationTokens(err.response.data.conversationTokens);
      setError('This conversation has reached its maximum length. Please summarize to continue.');
      return;
    }

    setError(err.response?.data?.message || 'Failed to send message');
  } finally {
    setLoading(false);
  }
}

// Add summarize handler
async function handleSummarizeAndContinue() {
  if (!currentConversationId) return;

  setLoading(true);
  setError('');

  try {
    const response = await api.post(
      `/api/conversations/${currentConversationId}/summarize-and-continue`
    );

    // Switch to new conversation
    setCurrentConversationId(response.data.newConversationId);
    setConversationLimitReached(false);

    // Show summary message
    setMessages([
      {
        id: 'summary',
        role: 'assistant',
        content: `📋 **Conversation Summary**\n\n${response.data.summary}\n\n---\n\n*This is a continuation of a previous conversation. The context above summarizes what we discussed.*`,
        timestamp: new Date(),
      },
    ]);

    // Success notification
    alert('Conversation summarized! Continue chatting here.');

  } catch (err) {
    setError('Failed to summarize conversation');
  } finally {
    setLoading(false);
  }
}

// Add summarization banner in JSX (before input area)
{conversationLimitReached && (
  <div className="border-t bg-yellow-50 border-yellow-200">
    <div className="max-w-3xl mx-auto px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-800">
            Conversation Limit Reached ({conversationTokens.toLocaleString()} / 150,000 tokens)
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
```

### Success Criteria

- [ ] Conversation limit error detected
- [ ] Yellow banner shown when limit reached
- [ ] "Summarize & Continue" button works
- [ ] New conversation created with summary
- [ ] User can continue chatting
- [ ] Summary displayed as first message

---

## Phase 1.7 Completion Checklist

### Backend - Conversations
- [ ] Conversations table created with token tracking
- [ ] user_daily_tokens table created
- [ ] chat_logs updated to store message content
- [ ] Conversation model working
- [ ] Conversation API endpoints functional (list, create, get, update, delete)
- [ ] Chat service creates conversations
- [ ] Conversation titles auto-generated
- [ ] Conversation history sent to Claude API

### Backend - Token Tracking
- [ ] UserDailyTokens model created
- [ ] Token tracking middleware (tokenBudgetCheck)
- [ ] Daily token limits enforced per tier
- [ ] Token usage headers in API responses
- [ ] Conversation token counter automatic (database trigger)
- [ ] Conversation 150k limit enforced

### Backend - Summarization
- [ ] Summarize-and-continue endpoint working
- [ ] Claude generates conversation summaries
- [ ] New conversation created with summary context
- [ ] Old conversation archived (not deleted)
- [ ] Summary stored in new conversation

### Frontend - Conversations
- [ ] Conversation sidebar implemented
- [ ] Can list all conversations
- [ ] Can create new conversation
- [ ] Can switch between conversations
- [ ] Can delete conversations
- [ ] Messages persist and load correctly
- [ ] Conversation history loads on selection
- [ ] Responsive design maintained

### Frontend - Summarization
- [ ] Conversation limit error detected
- [ ] Yellow banner shown when limit reached
- [ ] "Summarize & Continue" button functional
- [ ] New conversation created with summary
- [ ] User can continue chatting after summarization
- [ ] Summary displayed as first message in new conversation

### Testing
- [ ] Create multiple conversations
- [ ] Switch between conversations
- [ ] Messages persist after refresh
- [ ] Delete conversation works
- [ ] Anonymous users work without sidebar
- [ ] Conversation titles display correctly
- [ ] Token tracking works (check headers)
- [ ] Daily token limits enforced
- [ ] Conversation 150k limit triggers summarization
- [ ] Summarization creates new conversation
- [ ] Archived conversations not shown in sidebar

## Next Steps

1. ✅ Complete all checklist items
2. ✅ Test conversation switching
3. ✅ Verify message persistence
4. ✅ Update STATUS.md
5. ✅ Commit: `feat(chat): complete Phase 1.7 - chat sessions`
6. ➡️ Proceed to [Phase 1.8: Admin Dashboard](PHASE_1.8_ADMIN.md)

---

**Status:** ⏸️ Not Started
**Last Updated:** 2025-11-11
**Next Phase:** [Phase 1.8: Admin Dashboard](PHASE_1.8_ADMIN.md)
