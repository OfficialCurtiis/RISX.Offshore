// /api/verify-payment.js
import crypto from "crypto";

function extractTierKeyFromOrderId(order_id = "") {
  // order_id format created in create-payment.js: risx_${tierKey}_${Date.now()}_${rand}
  const m = String(order_id).match(/^risx_(beginner|intermediate|pro)_/i);
  return m ? m[1].toLowerCase() : null;
}

function signUnlockToken({ tierKey, paymentId, exp }) {
  const secret = process.env.RISX_TOKEN_SECRET;
  if (!secret) throw new Error("Missing RISX_TOKEN_SECRET on server");

  const payload = { tierKey, paymentId, exp };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  try {
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing NOWPAYMENTS_API_KEY on server" });

    const { payment_id } = req.query || {};
    if (!payment_id) return res.status(400).json({ error: "Missing payment_id" });

    const r = await fetch(`https://api.nowpayments.io/v1/payment/${payment_id}`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
    });

    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: "NOWPayments error", details: data });

    const statusLower = String(data.payment_status || "").toLowerCase();
    const tierKey = extractTierKeyFromOrderId(data.order_id);

    const out = {
      payment_id: data.payment_id,
      payment_status: data.payment_status,
      actually_paid: data.actually_paid,
      pay_amount: data.pay_amount,
      pay_currency: data.pay_currency,
      order_id: data.order_id,
      tierKey, // NEW
    };

    if ((statusLower === "confirmed" || statusLower === "finished") && tierKey) {
      const exp = Date.now() + 1000 * 60 * 60 * 24; // 24 hours (you can tune)
      out.unlock_token = signUnlockToken({
        tierKey,
        paymentId: String(data.payment_id),
        exp,
      });
      out.unlock_expires_at = exp;
    }

    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}