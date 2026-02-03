// /api/verify-token.js
import crypto from "crypto";

function verifyToken(token) {
  const secret = process.env.RISX_TOKEN_SECRET;
  if (!secret) throw new Error("Missing RISX_TOKEN_SECRET on server");

  const [body, sig] = String(token).split(".");
  if (!body || !sig) return { ok: false };

  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (expected !== sig) return { ok: false };

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false };
  }

  if (!payload?.tierKey || !payload?.paymentId || !payload?.exp) return { ok: false };
  if (Date.now() > Number(payload.exp)) return { ok: false, expired: true };

  return { ok: true, payload };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "Missing token" });

    const v = verifyToken(token);
    if (!v.ok) return res.status(401).json({ valid: false, expired: !!v.expired });

    return res.status(200).json({
      valid: true,
      tierKey: v.payload.tierKey,
      paymentId: v.payload.paymentId,
      exp: v.payload.exp,
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}