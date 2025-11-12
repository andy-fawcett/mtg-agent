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
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user on mount by checking session with backend
  useEffect(() => {
    fetchUser();
  }, []);

  /**
   * Fetch current user from session
   * Session cookie is automatically sent with the request
   */
  async function fetchUser() {
    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data.user);
    } catch (error) {
      // Not authenticated or session expired
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Login user with email and password
   * Backend sets session cookie automatically
   */
  async function login(email: string, password: string) {
    const response = await api.post('/api/auth/login', { email, password });
    setUser(response.data.user);
  }

  /**
   * Register new user
   * Backend sets session cookie automatically
   */
  async function register(email: string, password: string) {
    const response = await api.post('/api/auth/register', { email, password });
    setUser(response.data.user);
  }

  /**
   * Logout user
   * Backend destroys session
   */
  async function logout() {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear user state, even if API call fails
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
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
