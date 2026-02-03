// /api/admin-issue-token.js
import crypto from "crypto";

function signUnlockToken({ tierKey, paymentId, exp }) {
  const secret = process.env.RISX_TOKEN_SECRET;
  if (!secret) throw new Error("Missing RISX_TOKEN_SECRET");

  const payload = { tierKey, paymentId, exp };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const adminKey = process.env.RISX_ADMIN_KEY;
    if (!adminKey) return res.status(500).json({ error: "Missing RISX_ADMIN_KEY" });

    // Admin auth via header (never put this key in your site JS)
    const provided = req.headers["x-admin-key"];
    if (!provided || provided !== adminKey) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { tierKey } = req.body || {};
    const allowed = ["beginner", "intermediate", "pro"];
    if (!allowed.includes(String(tierKey))) {
      return res.status(400).json({ error: "Invalid tierKey" });
    }

    // short expiry so a leaked token dies fast
    const exp = Date.now() + 1000 * 60 * 10; // 10 minutes
    const token = signUnlockToken({
      tierKey,
      paymentId: `admin_${Date.now()}`,
      exp,
    });

    return res.status(200).json({ unlock_token: token, tierKey, exp });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}