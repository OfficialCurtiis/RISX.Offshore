// /api/verify-payment.js
import { signUnlockToken } from "./admin/_mint.js";

function extractTierKeyFromOrderId(order_id = "") {
  // order_id format: risx_${tierKey}_${intent}_${ts}_${rand}[_fr_${failedRunId}]
  const m = String(order_id).match(/^risx_(beginner|intermediate|pro)_/i);
  return m ? m[1].toLowerCase() : null;
}

function extractIntentFromOrderId(order_id = "") {
  const m = String(order_id).match(/^risx_(?:beginner|intermediate|pro)_(entry|restart)_/i);
  return m ? m[1].toLowerCase() : "entry";
}

function extractFailedRunIdFromOrderId(order_id = "") {
  const m = String(order_id).match(/_fr_([a-zA-Z0-9_-]{1,80})$/);
  return m ? m[1] : "";
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
    const intent = extractIntentFromOrderId(data.order_id);
    const failedRunId = intent === "restart" ? extractFailedRunIdFromOrderId(data.order_id) : "";

    const out = {
      payment_id: data.payment_id,
      payment_status: data.payment_status,
      actually_paid: data.actually_paid,
      pay_amount: data.pay_amount,
      pay_currency: data.pay_currency,
      order_id: data.order_id,
      tierKey,
      intent,
      failedRunId,
    };

    if ((statusLower === "confirmed" || statusLower === "finished") && tierKey) {
      const exp = Date.now() + 1000 * 60 * 60 * 24; // 24 hours (you can tune)
      out.unlock_token = signUnlockToken({
        tierKey,
        paymentId: String(data.payment_id),
        exp,
        intent,
        failedRunId,
      });
      out.unlock_expires_at = exp;
    }

    return res.status(200).json(out);
  } catch (e) {
    if (String(e?.message || "").includes("Missing RISX_ADMIN_KEY_CURRENT")) {
      return res.status(500).json({ error: "Missing RISX_ADMIN_KEY_CURRENT" });
    }
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
