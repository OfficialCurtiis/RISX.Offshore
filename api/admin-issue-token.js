// /api/admin-issue-token.js
import { requireAdmin } from "./admin/_auth.js";
import { signUnlockToken } from "./admin/_mint.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!requireAdmin(req, res)) return;

  try {
    const { tierKey } = req.body || {};
    const allowed = ["beginner", "intermediate", "pro"];
    if (!allowed.includes(String(tierKey))) {
      return res.status(400).json({ error: "Invalid tierKey" });
    }

    // short expiry so a leaked token dies fast
    const exp = Date.now() + 1000 * 60 * 60; // 10 minutes
    const token = signUnlockToken({
      tierKey,
      paymentId: `admin_${Date.now()}`,
      exp,
    });

    return res.status(200).json({ unlock_token: token, tierKey, exp });
  } catch (e) {
    if (String(e?.message || "").includes("Missing RISX_ADMIN_KEY_CURRENT")) {
      return res.status(500).json({ error: "Missing RISX_ADMIN_KEY_CURRENT" });
    }
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
