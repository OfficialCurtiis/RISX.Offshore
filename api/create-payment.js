// /api/create-payment.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing NOWPAYMENTS_API_KEY on server" });

    // ✅ Parse body first, then derive payCur
    const { tierKey, payCurrency, currency: bodyCurrency, intent = "entry", failedRunId = "" } = req.body || {};
    const payCur = String(payCurrency || bodyCurrency || "usdcsol").toLowerCase();
    if (!tierKey) return res.status(400).json({ error: "Missing tierKey" });

    // LOCK PRICES SERVER-SIDE (prevents client tampering)
    const TIERS = {
  beginner: { entryUsd: 10, restartUsd: 7 },
  intermediate: { entryUsd: 25, restartUsd: 18 },
  pro: { entryUsd: 50, restartUsd: 35 },
  };

    const tier = TIERS[tierKey];
    if (!tier) return res.status(400).json({ error: "Invalid tierKey" });

    const priceUsd = (intent === "restart") ? tier.restartUsd : tier.entryUsd;
    const allowed = new Set(["btc", "ltc", "trx", "sol", "usdtsol", "usdcsol"]);
    if (!allowed.has(payCur)) return res.status(400).json({ error: "Invalid payCurrency" });

    const normalizedIntent = String(intent || "").toLowerCase() === "restart" ? "restart" : "entry";
    const safeFailedRunId = String(failedRunId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
    const restartSuffix = normalizedIntent === "restart" && safeFailedRunId ? `_fr_${safeFailedRunId}` : "";
    const order_id = `risx_${tierKey}_${normalizedIntent}_${Date.now()}_${Math.random().toString(16).slice(2)}${restartSuffix}`;

   const payload = {
  price_amount: priceUsd,
  price_currency: "usd",
  pay_currency: payCur,
  order_id,
  order_description: `RISX ${tierKey} ${normalizedIntent === "restart" ? "restart" : "entry"}`,
  };

    const r = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(400).json({ error: "NOWPayments error", details: data });
    }

    // Return only what the frontend needs
    return res.status(200).json({
      tierKey,
      intent: normalizedIntent,
      failedRunId: normalizedIntent === "restart" ? safeFailedRunId : "",
      order_id: data.order_id || order_id,
      payment_id: data.payment_id,
      pay_address: data.pay_address,
      pay_amount: data.pay_amount,
      pay_currency: data.pay_currency,
      payment_status: data.payment_status,
      expiration_estimate_date: data.expiration_estimate_date,
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
