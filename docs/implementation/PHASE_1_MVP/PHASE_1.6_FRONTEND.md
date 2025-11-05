# Phase 1.6: Frontend Application

**Status:** ⏸️ Not Started
**Duration Estimate:** 8-12 hours
**Prerequisites:** Phases 1.0-1.5 complete (backend fully functional)
**Dependencies:** Next.js 14, React, TailwindCSS

## Objectives

Build a responsive web interface for the MTG Agent chat application.

- Next.js 14 (App Router) setup
- Authentication pages (login/register)
- Chat interface with message history
- Anonymous mode support
- Rate limit display
- Error handling and loading states
- Responsive design (mobile + desktop)

---

## Task 1.6.1: Next.js Project Setup

**Estimated Time:** 45 minutes

### Objectives

Initialize Next.js project with TypeScript and TailwindCSS.

### Steps

```bash
# Create Next.js app
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir

cd frontend

# Configure to use pnpm
cat >> package.json <<'EOF'
  "packageManager": "pnpm@10.0.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=10.0.0"
  }
EOF

# Install dependencies with pnpm
pnpm install axios
pnpm install react-markdown

# Configure environment
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3000
EOF
```

**Update `frontend/tailwind.config.ts`:**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
      },
    },
  },
  plugins: [],
}
export default config
```

**Create `frontend/lib/api.ts`:**

```typescript
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired, clear it
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Verification

```bash
cd frontend
pnpm run dev
# Visit http://localhost:3001
# Should see Next.js default page
```

### Success Criteria

- [ ] Next.js app created
- [ ] TypeScript configured
- [ ] TailwindCSS working
- [ ] API client configured
- [ ] Dev server runs

---

## Task 1.6.2: Authentication Context & Pages

**Estimated Time:** 120 minutes

### Objectives

Create authentication context and login/register pages.

### Steps

**Create `frontend/contexts/AuthContext.tsx`:**

```typescript
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  tier: string;
  emailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load token and user on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchUser() {
    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data.user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const response = await api.post('/api/auth/login', { email, password });
    const { token: newToken, user: newUser } = response.data;

    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
  }

  async function register(email: string, password: string) {
    const response = await api.post('/api/auth/register', { email, password });
    const { token: newToken, user: newUser } = response.data;

    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**Create `frontend/app/login/page.tsx`:**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/chat');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            MTG Agent
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/register"
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              Don't have an account? Register
            </Link>
          </div>

          <div className="text-center">
            <Link
              href="/chat"
              className="text-sm text-gray-600 hover:text-gray-500"
            >
              Try as anonymous (3 messages/day)
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Create `frontend/app/register/page.tsx`:**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    setLoading(true);

    try {
      await register(email, password);
      router.push('/chat');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Create Account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join MTG Agent
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <input
                type="email"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <input
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Password (min 12 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <input
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </form>

        <div className="mt-4 text-xs text-gray-500 text-center">
          <p>Password requirements:</p>
          <ul className="mt-1 space-y-1">
            <li>At least 12 characters</li>
            <li>Include uppercase and lowercase</li>
            <li>Include numbers and special characters</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
```

**Update `frontend/app/layout.tsx`:**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MTG Agent - Magic: The Gathering AI Assistant',
  description: 'Get expert help with Magic: The Gathering',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
```

### Verification

```bash
pnpm run dev
# Visit http://localhost:3001/register
# Create account and verify redirect to /chat
```

### Success Criteria

- [ ] Auth context works
- [ ] Can register new account
- [ ] Can login
- [ ] Can logout
- [ ] Token persists
- [ ] Redirect after auth

---

## Task 1.6.3: Chat Interface

**Estimated Time:** 180 minutes

### Objectives

Build the main chat interface with message history and loading states.

### Steps

**Create `frontend/app/chat/page.tsx`:**

```typescript
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

export default function ChatPage() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<any>(null);
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
                className="text-sm text-primary-600 hover:text-primary-700"
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
                  Anonymous users get 3 messages per day. <a href="/register" className="text-primary-600">Register</a> for 50/day!
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
                    ? 'bg-primary-600 text-white'
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
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
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
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={loading}
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
```

### Verification

```bash
pnpm run dev
# Visit http://localhost:3001/chat
# Send messages and verify responses
```

### Success Criteria

- [ ] Chat interface renders
- [ ] Can send messages
- [ ] Receives responses
- [ ] Messages display correctly
- [ ] Loading states work
- [ ] Error handling works
- [ ] Responsive design works

---

## Phase 1.6 Completion Checklist

### Setup
- [ ] Next.js project created
- [ ] TypeScript configured
- [ ] TailwindCSS working
- [ ] API client configured

### Authentication
- [ ] Auth context works
- [ ] Login page works
- [ ] Register page works
- [ ] Token persistence works
- [ ] Logout works

### Chat Interface
- [ ] Chat page renders
- [ ] Can send messages
- [ ] Receives responses
- [ ] Message history displays
- [ ] Loading states work
- [ ] Error handling works

### UI/UX
- [ ] Responsive on mobile
- [ ] Responsive on desktop
- [ ] Accessible (keyboard navigation)
- [ ] Loading indicators
- [ ] Error messages clear

## Common Issues

### Issue: CORS errors

**Solution:**
```typescript
// backend/src/index.ts
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true,
}));
```

### Issue: Token not persisting

**Solution:**
```typescript
// Check localStorage is available
if (typeof window !== 'undefined') {
  localStorage.setItem('token', token);
}
```

## Next Steps

1. ✅ Verify all checklist items
2. ✅ Test on mobile devices
3. ✅ Test all user flows
4. ✅ Commit: `feat(frontend): complete Phase 1.6`
5. ➡️ Proceed to [Phase 1.7: Testing](PHASE_1.7_TESTING.md)

---

**Status:** ⏸️ Not Started
**Last Updated:** 2025-11-01
**Next Phase:** [Phase 1.7: Integration & Testing](PHASE_1.7_TESTING.md)
