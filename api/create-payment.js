// /api/create-payment.js
import crypto from "crypto";
import { hasSupabaseAdminEnv, withSupabaseAdmin } from "./_supabaseAdmin.js";

const TIERS = {
  beginner: { entryUsd: 10, restartUsd: 7 },
  intermediate: { entryUsd: 25, restartUsd: 18 },
  pro: { entryUsd: 50, restartUsd: 35 },
};

const ALLOWED_PAY_CURRENCIES = new Set(["btc", "ltc", "trx", "sol", "usdtsol", "usdcsol"]);
const IDEMPOTENCY_SCOPE = "create_payment";
const IDEMPOTENCY_LOCK_MS = 60 * 1000;

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input || "")).digest("hex");
}

function normalizeIntent(intent) {
  return String(intent || "").toLowerCase() === "restart" ? "restart" : "entry";
}

function sanitizeFailedRunId(raw) {
  return String(raw || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function buildOrderId(tierKey, intent, failedRunId = "") {
  const suffix = intent === "restart" && failedRunId ? `_fr_${failedRunId}` : "";
  return `risx_${tierKey}_${intent}_${Date.now()}_${crypto.randomUUID().replace(/-/g, "")}${suffix}`;
}

function sanitizeText(raw, maxLen = 180) {
  return String(raw || "").trim().slice(0, maxLen);
}

function getIdempotencyKey(req, body) {
  const headerVal = req?.headers?.["x-idempotency-key"];
  const fromHeader = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  const key = String(fromHeader || body?.idempotencyKey || "").trim();
  return key || null;
}

async function getIdempotencyRecord(keyHash) {
  return withSupabaseAdmin("idempotency_lookup_create_payment", async (admin) => {
    const { data, error } = await admin
      .from("idempotency_keys")
      .select("*")
      .eq("scope", IDEMPOTENCY_SCOPE)
      .eq("key_hash", keyHash)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  });
}

async function reserveIdempotencyKey({ keyHash, requestHash }) {
  const lockUntil = new Date(Date.now() + IDEMPOTENCY_LOCK_MS).toISOString();
  await withSupabaseAdmin("idempotency_reserve_create_payment", async (admin) => {
    const { error } = await admin
      .from("idempotency_keys")
      .upsert(
        {
          scope: IDEMPOTENCY_SCOPE,
          key_hash: keyHash,
          request_hash: requestHash,
          locked_until: lockUntil,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "scope,key_hash" }
      );
    if (error) throw error;
  });
}

async function saveIdempotentResponse({ keyHash, statusCode, body }) {
  await withSupabaseAdmin("idempotency_save_response_create_payment", async (admin) => {
    const { error } = await admin
      .from("idempotency_keys")
      .update({
        response_code: Number(statusCode),
        response_body: body,
        locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("scope", IDEMPOTENCY_SCOPE)
      .eq("key_hash", keyHash);
    if (error) throw error;
  });
}

async function upsertPaymentByOrder(orderRow) {
  return withSupabaseAdmin("payments_upsert_by_order_id", async (admin) => {
    const { data, error } = await admin
      .from("payments")
      .upsert(orderRow, { onConflict: "order_id" })
      .select("id,order_id,payment_id,status")
      .single();
    if (error) throw error;
    return data;
  });
}

async function updatePaymentByOrder(orderId, patch) {
  return withSupabaseAdmin("payments_update_by_order_id", async (admin) => {
    const { error } = await admin
      .from("payments")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("order_id", orderId);
    if (error) throw error;
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!hasSupabaseAdminEnv()) {
    return res.status(500).json({
      error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on server",
    });
  }

  try {
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing NOWPAYMENTS_API_KEY on server" });

    const body = req.body || {};
    const tierKey = String(body.tierKey || "").toLowerCase().trim();
    const payCur = String(body.payCurrency || body.currency || "usdcsol").toLowerCase();
    const normalizedIntent = normalizeIntent(body.intent);
    const safeFailedRunId = sanitizeFailedRunId(body.failedRunId);
    const walletAddress = sanitizeText(body.wallet, 180);
    const email = sanitizeText(body.email, 320).toLowerCase();
    const idempotencyKey = getIdempotencyKey(req, body);

    if (!tierKey) return res.status(400).json({ error: "Missing tierKey" });
    if (!TIERS[tierKey]) return res.status(400).json({ error: "Invalid tierKey" });
    if (!ALLOWED_PAY_CURRENCIES.has(payCur)) return res.status(400).json({ error: "Invalid payCurrency" });

    const tier = TIERS[tierKey];
    const priceUsd = normalizedIntent === "restart" ? tier.restartUsd : tier.entryUsd;

    let idemKeyHash = null;
    let requestHash = null;
    if (idempotencyKey) {
      idemKeyHash = sha256Hex(idempotencyKey);
      requestHash = sha256Hex(
        JSON.stringify({
          tierKey,
          payCur,
          normalizedIntent,
          safeFailedRunId,
          walletAddress,
          email,
        })
      );

      const existing = await getIdempotencyRecord(idemKeyHash);
      if (existing) {
        if (existing.request_hash && existing.request_hash !== requestHash) {
          return res.status(409).json({ error: "Idempotency key re-used with different payload" });
        }
        if (existing.response_code && existing.response_body) {
          return res.status(Number(existing.response_code)).json(existing.response_body);
        }
        const lockedUntilMs = existing.locked_until ? Date.parse(String(existing.locked_until)) : 0;
        if (Number.isFinite(lockedUntilMs) && lockedUntilMs > Date.now()) {
          return res.status(409).json({ error: "Payment creation already in progress for this idempotency key" });
        }
      }
      await reserveIdempotencyKey({ keyHash: idemKeyHash, requestHash });
    }

    const order_id = buildOrderId(tierKey, normalizedIntent, safeFailedRunId);

    await upsertPaymentByOrder({
      order_id,
      payment_id: null,
      wallet_address: walletAddress,
      email,
      tier: tierKey,
      intent: normalizedIntent,
      status: "pending",
      amount_usd: priceUsd,
      pay_currency: payCur,
      provider: "nowpayments",
      provider_payload: {
        stage: "pending_before_provider_create",
        createdAt: new Date().toISOString(),
        failedRunId: normalizedIntent === "restart" ? safeFailedRunId : "",
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const providerPayload = {
      price_amount: priceUsd,
      price_currency: "usd",
      pay_currency: payCur,
      order_id,
      order_description: `RISX ${tierKey} ${normalizedIntent === "restart" ? "restart" : "entry"}`,
    };
    const callbackUrl = String(process.env.NOWPAYMENTS_IPN_CALLBACK_URL || "").trim();
    if (callbackUrl) {
      providerPayload.ipn_callback_url = callbackUrl;
    }

    const providerRes = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(providerPayload),
    });

    const providerData = await providerRes.json();
    if (!providerRes.ok) {
      await updatePaymentByOrder(order_id, {
        status: "failed",
        provider_payload: providerData || {},
      });
      const errorBody = { error: "NOWPayments error", details: providerData };
      if (idemKeyHash) await saveIdempotentResponse({ keyHash: idemKeyHash, statusCode: 400, body: errorBody });
      return res.status(400).json(errorBody);
    }

    const paymentStatus = String(providerData?.payment_status || "pending").toLowerCase();
    const normalizedStatus = ["finished", "confirmed"].includes(paymentStatus) ? "paid" : paymentStatus;
    const paymentId = sanitizeText(providerData?.payment_id, 180) || null;

    await updatePaymentByOrder(order_id, {
      payment_id: paymentId,
      status: ["pending", "paid", "expired", "cancelled", "failed"].includes(normalizedStatus)
        ? normalizedStatus
        : "pending",
      pay_amount: Number(providerData?.pay_amount || 0) || null,
      pay_currency: sanitizeText(providerData?.pay_currency || payCur, 64),
      paid_at: ["confirmed", "finished"].includes(paymentStatus) ? new Date().toISOString() : null,
      provider_payload: providerData || {},
    });

    const responseBody = {
      tierKey,
      intent: normalizedIntent,
      failedRunId: normalizedIntent === "restart" ? safeFailedRunId : "",
      order_id: providerData.order_id || order_id,
      payment_id: providerData.payment_id,
      pay_address: providerData.pay_address,
      pay_amount: providerData.pay_amount,
      pay_currency: providerData.pay_currency,
      payment_status: providerData.payment_status,
      expiration_estimate_date: providerData.expiration_estimate_date,
    };

    if (idemKeyHash) {
      await saveIdempotentResponse({ keyHash: idemKeyHash, statusCode: 200, body: responseBody });
    }
    return res.status(200).json(responseBody);
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
}
