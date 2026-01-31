// /api/create-payment.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing NOWPAYMENTS_API_KEY on server" });

    const { tierKey, payCurrency } = req.body || {};
    if (!tierKey) return res.status(400).json({ error: "Missing tierKey" });

    // LOCK PRICES SERVER-SIDE (prevents client tampering)
    const TIERS = {
      beginner: { entryUsd: 10 },
      intermediate: { entryUsd: 25 },
      pro: { entryUsd: 50 },
    };

    const tier = TIERS[tierKey];
    if (!tier) return res.status(400).json({ error: "Invalid tierKey" });

    // Allowed pay currencies (use NOWPayments tickers)
    // BTC, LTC, TRX, SOL, USDT Solana, USDC Solana
    const allowed = new Set(["btc", "ltc", "trx", "sol", "usdtsol", "usdcsol"]);
    const currency = (payCurrency || "usdcsol").toLowerCase();
    if (!allowed.has(currency)) return res.status(400).json({ error: "Invalid payCurrency" });

    const order_id = `risx_${tierKey}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const payload = {
      price_amount: tier.entryUsd,
      price_currency: "usd",
      pay_currency: currency,
      order_id,
      order_description: `RISX ${tierKey} entry`,
      // Optional: add later if you want webhooks
      // ipn_callback_url: `${process.env.PUBLIC_BASE_URL}/api/nowpayments-ipn`,
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