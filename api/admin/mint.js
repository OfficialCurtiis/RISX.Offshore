import {
  canAttemptAdminAction,
  parseJsonBody,
  recordFailedAdminAction,
  requireAdmin,
} from "./_auth.js";
import { signUnlockToken } from "./_mint.js";

const ALLOWED_TIERS = new Set(["beginner", "intermediate", "pro"]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!requireAdmin(req, res)) return;

  const limit = canAttemptAdminAction(req, "admin_mint", 20, 10 * 60 * 1000);
  if (!limit.allowed) {
    return res.status(429).json({ error: "Too many requests", retryAfterSec: limit.retryAfterSec });
  }

  try {
    const { tierKey, expiresInSec } = parseJsonBody(req);
    const tier = String(tierKey || "").toLowerCase();
    if (!ALLOWED_TIERS.has(tier)) {
      recordFailedAdminAction(req, "admin_mint", "invalid_tier");
      return res.status(400).json({ error: "Invalid tierKey" });
    }

    const ttlSec = Math.max(60, Math.min(7 * 24 * 60 * 60, Number(expiresInSec) || 60 * 60));
    const exp = Date.now() + ttlSec * 1000;
    const token = signUnlockToken({
      tierKey: tier,
      paymentId: `admin_${Date.now()}`,
      exp,
    });

    return res.status(200).json({ unlock_token: token, tierKey: tier, exp });
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg.includes("Missing RISX_ADMIN_KEY_CURRENT")) {
      return res.status(500).json({ error: "Missing RISX_ADMIN_KEY_CURRENT" });
    }
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
