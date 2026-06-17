import { prisma } from "../config/database";

const OTP_EXPIRY_MINUTES = 3;
const MAX_ATTEMPTS = 5;

export const otpRepository = {
  async upsert(email: string, code: string): Promise<void> {
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await prisma.otpCode.upsert({
      where: { email },
      update: { code, attempts: 0, expiresAt, createdAt: new Date() },
      create: { email, code, attempts: 0, expiresAt },
    });
  },

  async findByEmail(email: string) {
    return prisma.otpCode.findUnique({ where: { email } });
  },

  async incrementAttempts(email: string): Promise<number> {
    const updated = await prisma.otpCode.update({
      where: { email },
      data: { attempts: { increment: 1 } },
    });
    return updated.attempts;
  },

  async delete(email: string): Promise<void> {
    await prisma.otpCode.delete({ where: { email } }).catch(() => {});
  },

  async deleteExpired(): Promise<void> {
    await prisma.otpCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  },

  get expiryMinutes() {
    return OTP_EXPIRY_MINUTES;
  },

  get maxAttempts() {
    return MAX_ATTEMPTS;
  },
};
