import {
  canAttemptAdminAction,
  recordFailedAdminAction,
  requireAdmin,
} from "./_auth.js";
import { getMintKeyStatus } from "./_mint.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (!requireAdmin(req, res)) return;

  const limit = canAttemptAdminAction(req, "admin_status", 60, 10 * 60 * 1000);
  if (!limit.allowed) {
    return res.status(429).json({ error: "Too many requests", retryAfterSec: limit.retryAfterSec });
  }

  try {
    const mint = getMintKeyStatus();
    const auth = {
      hasAdminPasswordHash: !!process.env.ADMIN_PASSWORD_HASH,
      hasAdminToken: !!process.env.ADMIN_TOKEN,
    };

    if (!mint.hasCurrent) {
      recordFailedAdminAction(req, "admin_status", "missing_current_key");
      return res.status(500).json({
        error: "Missing RISX_ADMIN_KEY_CURRENT",
        mint,
        auth,
      });
    }

    return res.status(200).json({
      ok: true,
      mint,
      auth,
      strategy: "current_only",
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
