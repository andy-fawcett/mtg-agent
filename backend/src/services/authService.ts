import { UserModel } from '../models/User';
import { hashPassword, verifyPassword, validatePasswordStrength, validateEmail } from '../utils/password';
import { User } from '../types/database.types';
import { Session } from 'express-session';

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    tier: string;
    emailVerified: boolean;
  };
}

export class AuthService {
  /**
   * Register new user and create session
   * @param input - Registration details (email, password)
   * @param session - Express session object
   * @returns Promise resolving to auth response with user data
   */
  static async register(input: RegisterInput, session: Session): Promise<AuthResponse> {
    const { email, password } = input;

    // Validate email format
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    const passwordErrors = validatePasswordStrength(password);
    if (passwordErrors.length > 0) {
      throw new Error(`Password validation failed: ${passwordErrors.join(', ')}`);
    }

    // Check if email already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password using bcrypt
    const passwordHash = await hashPassword(password);

    // Create user in database
    const user = await UserModel.create({
      email,
      password_hash: passwordHash,
      tier: 'free', // New users start with free tier
    });

    // Create session for the newly registered user
    session.userId = user.id;
    session.email = user.email;
    session.tier = user.tier;

    return {
      user: {
        id: user.id,
        email: user.email,
        tier: user.tier,
        emailVerified: user.email_verified,
      },
    };
  }

  /**
   * Login user and create session
   * @param input - Login credentials (email, password)
   * @param session - Express session object
   * @returns Promise resolving to auth response with user data
   */
  static async login(input: LoginInput, session: Session): Promise<AuthResponse> {
    const { email, password } = input;

    // Find user by email
    const user = await UserModel.findByEmail(email);
    if (!user) {
      // Generic error message to prevent email enumeration attacks
      throw new Error('Invalid email or password');
    }

    // Verify password against stored hash
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      // Same generic error message for security
      throw new Error('Invalid email or password');
    }

    // Create session for authenticated user
    session.userId = user.id;
    session.email = user.email;
    session.tier = user.tier;

    return {
      user: {
        id: user.id,
        email: user.email,
        tier: user.tier,
        emailVerified: user.email_verified,
      },
    };
  }

  /**
   * Logout user by destroying session
   * @param session - Express session object
   * @returns Promise that resolves when session is destroyed
   */
  static async logout(session: Session): Promise<void> {
    return new Promise((resolve, reject) => {
      session.destroy((err) => {
        if (err) {
          reject(new Error('Failed to logout'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get user from session (validate session is still valid)
   * @param userId - User ID from session
   * @returns Promise resolving to user object
   */
  static async getUserFromSession(userId: string): Promise<User> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }
}
