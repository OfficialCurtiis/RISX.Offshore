// /api/verify-token.js
import { verifyUnlockToken } from "./admin/_mint.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { token, tierKey: requestedTier } = req.body || {};
    if (!token) return res.status(400).json({ error: "Missing token" });

    const v = verifyUnlockToken(token);
    if (!v.ok) return res.status(401).json({ valid: false, expired: !!v.expired });

    const tokenTier = String(v.payload.tierKey || "").toLowerCase();
    const requestTier = String(requestedTier || "").toLowerCase();
    if (requestTier && requestTier !== tokenTier) {
      return res.status(409).json({ valid: false, error: "Tier mismatch" });
    }

    return res.status(200).json({
      valid: true,
      tierKey: tokenTier,
      paymentId: v.payload.paymentId,
      exp: v.payload.exp,
      jti: String(v.payload.jti || ""),
      intent: ["entry", "restart"].includes(String(v.payload.intent || "").toLowerCase())
        ? String(v.payload.intent).toLowerCase()
        : "entry",
      failedRunId: String(v.payload.failedRunId || ""),
    });
  } catch (e) {
    if (String(e?.message || "").includes("Missing RISX_ADMIN_KEY_CURRENT")) {
      return res.status(500).json({ error: "Missing RISX_ADMIN_KEY_CURRENT" });
    }
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
