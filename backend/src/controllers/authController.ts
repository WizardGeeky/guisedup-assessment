import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { authService } from "../services/authService";
import { userRepository } from "../repositories/userRepository";
import { otpRepository } from "../repositories/otpRepository";
import { sendOtpEmail } from "../utils/mailer";
import { sendSuccess, sendCreated } from "../utils/apiResponse";
import { UnauthorizedError } from "../utils/errors";

// Reset tokens stay in-memory (short-lived, 15 min, single-use)
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
        // Upsert: replaces any existing OTP for this email — one OTP at a time, 3 min expiry
        await otpRepository.upsert(email, otp);

        console.log(`[OTP] Generated for ${email}: ${otp} (expires in ${otpRepository.expiryMinutes} min)`);

        // Fire-and-forget — never block the HTTP response on SMTP
        sendOtpEmail(email, otp, user.username).catch((mailErr) => {
          console.error("[MAILER] Failed to send OTP email:", mailErr);
        });
      }

      // Always respond 200 to prevent email enumeration
      sendSuccess(res, { sent: true }, 200, undefined, "If an account exists, a reset code has been sent");
    } catch (err) {
      next(err);
    }
  },

  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body as { email: string; otp: string };

      const record = await otpRepository.findByEmail(email);
      if (!record) throw new UnauthorizedError("OTP not found or expired. Please request a new one.");

      if (new Date() > record.expiresAt) {
        await otpRepository.delete(email);
        throw new UnauthorizedError("OTP has expired (3 minutes). Please request a new one.");
      }

      const attempts = await otpRepository.incrementAttempts(email);
      if (attempts > otpRepository.maxAttempts) {
        await otpRepository.delete(email);
        throw new UnauthorizedError("Too many attempts. Please request a new OTP.");
      }

      if (record.code !== otp) {
        throw new UnauthorizedError(`Invalid OTP. ${otpRepository.maxAttempts - attempts} attempt(s) remaining.`);
      }

      // OTP valid — delete it and issue a short-lived reset token
      await otpRepository.delete(email);
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
