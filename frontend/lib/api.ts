import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Axios instance configured for session-based authentication
 * IMPORTANT: withCredentials: true sends session cookies with every request
 */
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // CRITICAL: Send cookies with requests for session-based auth
});

/**
 * Global response interceptor for handling authentication errors
 * Redirects to login page when session expires (401)
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Session expired or not authenticated
      // Redirect to login (but not if already on login/register pages)
      if (typeof window !== 'undefined' && !['/login', '/register'].includes(window.location.pathname)) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
