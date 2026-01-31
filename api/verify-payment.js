// /api/verify-payment.js
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

    return res.status(200).json({
      payment_id: data.payment_id,
      payment_status: data.payment_status,
      actually_paid: data.actually_paid,
      pay_amount: data.pay_amount,
      pay_currency: data.pay_currency,
      order_id: data.order_id,
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}