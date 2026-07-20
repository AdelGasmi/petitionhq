/**
 * Account lockout — brute-force protection with exponential backoff.
 *
 * After N failed login attempts, the account is locked for an increasing
 * duration. The lockout is per-account (not per-IP) to prevent credential
 * stuffing across different IPs.
 *
 * Lockout schedule:
 *   5 failures  →  1 minute
 *   10 failures →  5 minutes
 *   15 failures → 15 minutes
 *   20 failures → 60 minutes
 *   25+ failures→  4 hours
 *
 * A successful login resets the counter to 0.
 */

import { prisma } from "./prisma";

const LOCKOUT_TIERS = [
  { threshold: 5,  durationMs: 1 * 60 * 1000 },       //  1 min
  { threshold: 10, durationMs: 5 * 60 * 1000 },       //  5 min
  { threshold: 15, durationMs: 15 * 60 * 1000 },      // 15 min
  { threshold: 20, durationMs: 60 * 60 * 1000 },      //  1 hour
  { threshold: 25, durationMs: 4 * 60 * 60 * 1000 },  //  4 hours
];

function getLockoutDuration(failures: number): number {
  let duration = 0;
  for (const tier of LOCKOUT_TIERS) {
    if (failures >= tier.threshold) duration = tier.durationMs;
  }
  return duration;
}

export type LockoutStatus = {
  locked: boolean;
  /** Seconds remaining until unlock. 0 if not locked. */
  retryAfterSeconds: number;
};

/**
 * Check if an account is currently locked.
 * Returns { locked: false } if the user doesn't exist (don't leak info).
 */
export async function checkLockout(userId: string): Promise<LockoutStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true },
  });

  if (!user?.lockedUntil) return { locked: false, retryAfterSeconds: 0 };

  const remaining = user.lockedUntil.getTime() - Date.now();
  if (remaining <= 0) {
    return { locked: false, retryAfterSeconds: 0 };
  }

  return {
    locked: true,
    retryAfterSeconds: Math.ceil(remaining / 1000),
  };
}

/**
 * Record a failed login attempt. May trigger or extend a lockout.
 */
export async function recordFailedAttempt(userId: string): Promise<LockoutStatus> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { failedAttempts: { increment: 1 } },
    select: { failedAttempts: true },
  });

  const duration = getLockoutDuration(user.failedAttempts);
  if (duration > 0) {
    const lockedUntil = new Date(Date.now() + duration);
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil },
    });
    return {
      locked: true,
      retryAfterSeconds: Math.ceil(duration / 1000),
    };
  }

  return { locked: false, retryAfterSeconds: 0 };
}

/**
 * Reset the failure counter on successful login.
 */
export async function resetLockout(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedAttempts: 0, lockedUntil: null },
  });
}
