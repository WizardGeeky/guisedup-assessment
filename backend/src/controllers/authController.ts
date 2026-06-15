import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { authService } from "../services/authService";
import { userRepository } from "../repositories/userRepository";
import { sendOtpEmail } from "../utils/mailer";
import { sendSuccess, sendCreated } from "../utils/apiResponse";
import { UnauthorizedError } from "../utils/errors";

// In-memory OTP store (keyed by email)
const otpStore = new Map<string, { otp: string; username: string; expiresAt: number; attempts: number }>();
// In-memory reset token store (keyed by UUID token)
const resetTokenStore = new Map<string, { email: string; expiresAt: number }>();

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const authController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body as { email: string; username: string; password: string });
      sendCreated(res, result, "Registration successful");
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body as { email: string; password: string });
      sendSuccess(res, result, 200, undefined, "Login successful");
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as { refreshToken: string };
      const tokens = await authService.refresh(refreshToken);
      sendSuccess(res, tokens);
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as { refreshToken: string };
      await authService.logout(refreshToken);
      sendSuccess(res, null, 200, undefined, "Logged out successfully");
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, req.user);
    } catch (err) {
      next(err);
    }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body as { email: string };

      const user = await userRepository.findByEmail(email);
      if (user) {
        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
        otpStore.set(email, { otp, username: user.username, expiresAt, attempts: 0 });

        try {
          await sendOtpEmail(email, otp, user.username);
        } catch (mailErr) {
          // Log but don't fail — dev console fallback already logs the OTP
          console.error("[MAILER] Failed to send OTP email:", mailErr);
        }
      }

      // Always respond with success to prevent email enumeration
      sendSuccess(res, { sent: true }, 200, undefined, "If an account exists, a reset code has been sent");
    } catch (err) {
      next(err);
    }
  },

  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body as { email: string; otp: string };

      const record = otpStore.get(email);
      if (!record) throw new UnauthorizedError("OTP not found or expired. Please request a new one.");
      if (Date.now() > record.expiresAt) {
        otpStore.delete(email);
        throw new UnauthorizedError("OTP has expired. Please request a new one.");
      }

      record.attempts += 1;
      if (record.attempts > 5) {
        otpStore.delete(email);
        throw new UnauthorizedError("Too many attempts. Please request a new OTP.");
      }

      if (record.otp !== otp) {
        throw new UnauthorizedError("Invalid OTP. Please try again.");
      }

      // OTP valid — issue reset token (valid for 15 minutes)
      otpStore.delete(email);
      const resetToken = randomUUID();
      resetTokenStore.set(resetToken, { email, expiresAt: Date.now() + 15 * 60 * 1000 });

      sendSuccess(res, { resetToken }, 200, undefined, "OTP verified successfully");
    } catch (err) {
      next(err);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body as { token: string; newPassword: string };

      const record = resetTokenStore.get(token);
      if (!record) throw new UnauthorizedError("Invalid or expired reset token.");
      if (Date.now() > record.expiresAt) {
        resetTokenStore.delete(token);
        throw new UnauthorizedError("Reset token has expired. Please start over.");
      }

      await authService.resetPassword(record.email, newPassword);
      resetTokenStore.delete(token);

      sendSuccess(res, null, 200, undefined, "Password reset successfully");
    } catch (err) {
      next(err);
    }
  },
};
