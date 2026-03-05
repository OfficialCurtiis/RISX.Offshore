import {
  canAttemptAdminAction,
  recordFailedAdminAction,
  requireAdmin,
} from "./_auth.js";
import { getMintKeyStatus, signUnlockToken } from "./_mint.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!requireAdmin(req, res)) return;

  const limit = canAttemptAdminAction(req, "admin_rotate_key", 10, 10 * 60 * 1000);
  if (!limit.allowed) {
    return res.status(429).json({ error: "Too many requests", retryAfterSec: limit.retryAfterSec });
  }

  try {
    const status = getMintKeyStatus();
    if (!status.hasCurrent) {
      recordFailedAdminAction(req, "admin_rotate_key", "missing_current_key");
      return res.status(500).json({ error: "Missing RISX_ADMIN_KEY_CURRENT" });
    }

    // Sanity check current key is usable for signing.
    signUnlockToken({ tierKey: "beginner", paymentId: "rotate_check", exp: Date.now() + 60_000 });

    return res.status(200).json({
      ok: true,
      message: "Rotation validation passed. Ensure Vercel env vars are updated, then redeploy.",
      status,
      strategy: "current_only",
    });
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg.includes("Missing RISX_ADMIN_KEY_CURRENT")) {
      return res.status(500).json({ error: "Missing RISX_ADMIN_KEY_CURRENT" });
    }
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
