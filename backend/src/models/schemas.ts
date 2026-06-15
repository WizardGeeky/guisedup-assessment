import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be at most 30 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers, and underscores"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
});

export const createPostSchema = z.object({
  body: z.object({
    text: z
      .string()
      .min(1, "Post text cannot be empty")
      .max(2000, "Post text is too long (max 2000 chars)"),
    imageUrl: z.string().url("Invalid image URL").optional(),
  }),
});

export const updatePostSchema = z.object({
  body: z.object({
    text: z
      .string()
      .min(1, "Post text cannot be empty")
      .max(2000, "Post text is too long (max 2000 chars)"),
  }),
});

export const interactionSchema = z.object({
  body: z.object({
    postId: z.string().uuid("Invalid post ID"),
    type: z.enum(["VIEW", "REPLY", "REACTION"], {
      errorMap: () => ({ message: "Type must be VIEW, REPLY, or REACTION" }),
    }),
  }),
});

export const feedQuerySchema = z.object({
  query: z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
  }),
});

export const searchQuerySchema = z.object({
  query: z.object({
    q: z.string().min(1, "Query 'q' is required"),
    limit: z.coerce.number().min(1).max(50).optional(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d{6}$/, "OTP must be numeric"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().uuid("Invalid reset token"),
    newPassword: z.string().min(6, "Password must be at least 6 characters").max(128),
  }),
});
