import logger from "./logger";
/**
 * Cloudflare Turnstile server-side verification.
 *
 * Fail-open design: real users must never be blocked by CAPTCHA failures.
 * Turnstile is a speed bump for bots, not a wall for humans.
 *
 * Passes when:
 *   - TURNSTILE_SECRET_KEY is not set (local dev)
 *   - Client widget errored (sends "__turnstile_failed__" marker)
 *   - Cloudflare siteverify returns success: true
 *   - Network error reaching Cloudflare (fail-open)
 *
 * Blocks when:
 *   - Token is missing/empty AND secret is configured (likely bot)
 *   - Cloudflare explicitly says success: false (likely bot)
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // No secret configured — skip verification (local dev)
  if (!secret) return true;

  // Client-side widget errored (domain mismatch, network issue, CSP block)
  // Fail-open: don't punish users for infra problems
  if (token === "__turnstile_failed__") {
    logger.warn("[turnstile] Client widget failed — passing through");
    return true;
  }

  // No token at all — likely a bot that didn't render the widget
  if (!token) return false;

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });

    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };

    if (!data.success) {
      logger.warn("[turnstile] Verification failed:", data["error-codes"]);
    }

    return data.success;
  } catch (e) {
    // Network error verifying with Cloudflare — fail open
    logger.error("[turnstile] Verification request failed:", e);
    return true;
  }
}
