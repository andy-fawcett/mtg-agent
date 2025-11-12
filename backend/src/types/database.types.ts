// User types
export type UserTier = 'anonymous' | 'free' | 'premium' | 'enterprise';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  tier: UserTier;
  email_verified: boolean;
  oauth_provider: string | null;
  oauth_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateUserInput {
  email: string;
  password_hash: string;
  tier?: UserTier;
}

export interface UpdateUserInput {
  email?: string;
  password_hash?: string;
  tier?: UserTier;
  email_verified?: boolean;
}

// Session types
export interface Session {
  id: string;
  user_id: string | null;
  session_token: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: Date;
  created_at: Date;
}

// Chat log types (updated with token breakdown, actual cost, and message content)
export interface ChatLog {
  id: string;
  user_id: string | null;
  session_id: string | null;
  conversation_id: string | null;  // NEW: Link to conversation

  // Message content (NEW for Phase 1.7)
  user_message: string;
  assistant_response: string | null;

  message_length: number;
  response_length: number | null;

  // Token breakdown (updated from original design)
  input_tokens: number | null;
  output_tokens: number | null;
  tokens_used: number | null;  // Total

  // Actual cost from API response (renamed from estimated_cost_cents)
  actual_cost_cents: number | null;

  tools_used: string[] | null;
  success: boolean;
  error_message: string | null;
  duration_ms: number | null;
  created_at: Date;
}

export interface CreateChatLogInput {
  user_id?: string;
  session_id?: string;
  conversation_id?: string;  // NEW

  // Message content (NEW)
  user_message?: string;
  assistant_response?: string;

  message_length: number;
  response_length?: number;

  // Token breakdown
  input_tokens?: number;
  output_tokens?: number;
  tokens_used?: number;

  // Actual cost
  actual_cost_cents?: number;

  tools_used?: string[];
  success: boolean;
  error_message?: string;
  duration_ms?: number;
}

// Daily cost types
export interface DailyCost {
  date: Date;
  total_cost_cents: number;
  total_requests: number;
  total_tokens: number;
  unique_users: number;
  updated_at: Date;
}
