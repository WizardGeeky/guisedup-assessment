import bcrypt from "bcrypt";
import { userRepository } from "../repositories/userRepository";
import { refreshTokenRepository } from "../repositories/refreshTokenRepository";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../middleware/auth";
import { ConflictError, UnauthorizedError } from "../utils/errors";
import { env } from "../config/env";

const BCRYPT_ROUNDS = 12;

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    username: string;
    avatarUrl: string | null;
  };
  tokens: AuthTokens;
}

export const authService = {
  async register(input: RegisterInput): Promise<AuthResult> {
    const [existingEmail, existingUsername] = await Promise.all([
      userRepository.findByEmail(input.email),
      userRepository.findByUsername(input.username),
    ]);

    if (existingEmail) throw new ConflictError("Email already registered");
    if (existingUsername) throw new ConflictError("Username already taken");

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await userRepository.create({
      email: input.email,
      username: input.username,
      passwordHash,
    });

    const tokens = await authService.issueTokens(user);

    return {
      user: { id: user.id, email: user.email, username: user.username, avatarUrl: user.avatarUrl },
      tokens,
    };
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await userRepository.findByEmail(input.email);

    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const tokens = await authService.issueTokens(user);

    return {
      user: { id: user.id, email: user.email, username: user.username, avatarUrl: user.avatarUrl },
      tokens,
    };
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const stored = await refreshTokenRepository.findByToken(refreshToken);

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = await userRepository.findById(payload.userId);
      if (!user) throw new UnauthorizedError("User no longer exists");

      // Rotate refresh token (prevents replay attacks)
      await refreshTokenRepository.revoke(refreshToken);
      return authService.issueTokens(user);
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError("Invalid refresh token");
    }
  },

  async logout(refreshToken: string): Promise<void> {
    await refreshTokenRepository.revoke(refreshToken);
  },

  async resetPassword(email: string, newPassword: string): Promise<void> {
    const user = await userRepository.findByEmail(email);
    if (!user) throw new UnauthorizedError("User not found");
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await userRepository.updatePasswordHash(email, passwordHash);
  },

  async issueTokens(user: { id: string; email: string; username: string }): Promise<AuthTokens> {
    const payload = { userId: user.id, email: user.email, username: user.username };
    const accessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    // Persist refresh token with expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    await refreshTokenRepository.create(user.id, newRefreshToken, expiresAt);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: env.JWT_EXPIRES_IN,
    };
  },
};
