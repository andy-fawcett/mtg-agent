import { z } from 'zod';

/**
 * Auth validation schemas
 */
export const RegisterSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password too long'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password required'),
});

/**
 * Chat validation schema
 * Trims whitespace first, then validates length
 */
export const ChatSchema = z.object({
  message: z.string()
    .transform(msg => msg.trim())
    .pipe(
      z.string()
        .min(1, 'Message cannot be empty')
        .max(4000, 'Message too long (max 4000 characters)')
    ),
});

/**
 * Type inference from schemas
 */
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ChatInput = z.infer<typeof ChatSchema>;
