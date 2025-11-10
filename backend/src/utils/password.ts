import bcrypt from 'bcrypt';

// Bcrypt cost factor (higher = more secure but slower)
// Production should use 12+, can be reduced for development
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

/**
 * Hash a password using bcrypt
 * @param password - Plain text password to hash
 * @returns Promise resolving to bcrypt hash
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password against hash
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns Promise resolving to true if password matches
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 * Returns array of errors, empty if valid
 *
 * Requirements:
 * - At least 12 characters
 * - Less than 128 characters
 * - Contains lowercase letter
 * - Contains uppercase letter
 * - Contains number
 * - Contains special character
 * - Not a common password
 *
 * @param password - Password to validate
 * @returns Array of error messages (empty if valid)
 */
export function validatePasswordStrength(password: string): string[] {
  const errors: string[] = [];

  // Length check
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  // Complexity checks
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Common password check
  const commonPasswords = [
    'password',
    'password123',
    'qwerty',
    '123456',
    'admin',
    'letmein',
  ];

  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push('Password is too common');
  }

  return errors;
}

/**
 * Validate email format
 * @param email - Email address to validate
 * @returns true if email format is valid
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}
