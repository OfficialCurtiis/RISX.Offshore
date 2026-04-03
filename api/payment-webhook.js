import crypto from "crypto";
import { hasSupabaseAdminEnv, withSupabaseAdmin } from "./_supabaseAdmin.js";

const WEBHOOK_SCOPE = "nowpayments_webhook";
const WEBHOOK_LOCK_MS = 60 * 1000;

function readIp(req) {
  const xff = req?.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) return xff.split(",")[0].trim();
  return String(req?.socket?.remoteAddress || "unknown");
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input || "")).digest("hex");
}

function timingSafeHexEq(a, b) {
  const aa = Buffer.from(String(a || "").toLowerCase(), "utf8");
  const bb = Buffer.from(String(b || "").toLowerCase(), "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function sanitizeText(raw, maxLen = 240) {
  return String(raw || "").trim().slice(0, maxLen);
}

function toNumber(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function normalizePaymentStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "confirmed" || s === "finished") return "paid";
  if (s === "expired") return "expired";
  if (s === "cancelled") return "cancelled";
  if (s === "failed" || s === "refunded") return "failed";
  return "pending";
}

function sortObjectDeep(value) {
  if (Array.isArray(value)) return value.map((item) => sortObjectDeep(item));
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((out, key) => {
      out[key] = sortObjectDeep(value[key]);
      return out;
    }, {});
}

async function parseWebhookBody(req) {
  if (req?.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (Buffer.isBuffer(req?.body)) {
    return JSON.parse(req.body.toString("utf8") || "{}");
  }
  if (typeof req?.body === "string") {
    return JSON.parse(req.body || "{}");
  }

  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", resolve);
    req.on("error", reject);
  });
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
}

function canonicalWebhookPayload(payloadObj) {
  const sorted = sortObjectDeep(payloadObj || {});
  return JSON.stringify(sorted);
}

function extractTierKeyFromOrderId(orderId = "") {
  const m = String(orderId).match(/^risx_(beginner|intermediate|pro)_/i);
  return m ? m[1].toLowerCase() : "";
}

function extractIntentFromOrderId(orderId = "") {
  const m = String(orderId).match(/^risx_(?:beginner|intermediate|pro)_(entry|restart)_/i);
  return m ? m[1].toLowerCase() : "entry";
}

function extractFailedRunIdFromOrderId(orderId = "") {
  const m = String(orderId).match(/_fr_([a-zA-Z0-9_-]{1,80})$/);
  return m ? m[1] : "";
}

function newRunId() {
  return `run_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

async function getIdempotencyRecord(keyHash) {
  return withSupabaseAdmin("webhook_idem_lookup", async (admin) => {
    const { data, error } = await admin
      .from("idempotency_keys")
      .select("*")
      .eq("scope", WEBHOOK_SCOPE)
      .eq("key_hash", keyHash)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  });
}

async function reserveIdempotencyRecord({ keyHash }) {
  const lockUntil = new Date(Date.now() + WEBHOOK_LOCK_MS).toISOString();
  await withSupabaseAdmin("webhook_idem_reserve", async (admin) => {
    const { error } = await admin
      .from("idempotency_keys")
      .upsert(
        {
          scope: WEBHOOK_SCOPE,
          key_hash: keyHash,
          request_hash: keyHash,
          locked_until: lockUntil,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "scope,key_hash" }
      );
    if (error) throw error;
  });
}

async function finalizeIdempotencyRecord({ keyHash, statusCode, body }) {
  await withSupabaseAdmin("webhook_idem_finalize", async (admin) => {
    const { error } = await admin
      .from("idempotency_keys")
      .update({
        response_code: Number(statusCode),
        response_body: body,
        locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("scope", WEBHOOK_SCOPE)
      .eq("key_hash", keyHash);
    if (error) throw error;
  });
}

async function findPaymentByIds({ paymentId, orderId }) {
  return withSupabaseAdmin("webhook_find_payment", async (admin) => {
    if (paymentId) {
      const { data, error } = await admin
        .from("payments")
        .select("*")
        .eq("payment_id", paymentId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
    }
    if (orderId) {
      const { data, error } = await admin
        .from("payments")
        .select("*")
        .eq("order_id", orderId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
    }
    return null;
  });
}

async function upsertPaymentFromWebhook({
  existing,
  paymentId,
  orderId,
  tierKey,
  intent,
  normalizedStatus,
  payload,
  payAmount,
  payCurrency,
  walletAddress,
  email,
}) {
  const effectiveOrderId = orderId || existing?.order_id || `webhook_${paymentId || crypto.randomUUID()}`;
  const paidAt = normalizedStatus === "paid" ? new Date().toISOString() : null;
  const row = {
    order_id: effectiveOrderId,
    payment_id: paymentId || existing?.payment_id || null,
    wallet_address: walletAddress || existing?.wallet_address || "",
    email: email || existing?.email || "",
    tier: tierKey || existing?.tier || "beginner",
    intent: intent || existing?.intent || "entry",
    status: normalizedStatus,
    amount_usd: toNumber(payload?.price_amount) ?? existing?.amount_usd ?? null,
    pay_amount: payAmount ?? existing?.pay_amount ?? null,
    pay_currency: payCurrency || existing?.pay_currency || null,
    provider: "nowpayments",
    provider_payload: payload || {},
    paid_at: paidAt || existing?.paid_at || null,
    updated_at: new Date().toISOString(),
  };

  return withSupabaseAdmin("webhook_upsert_payment", async (admin) => {
    if (existing?.id) {
      const { data, error } = await admin
        .from("payments")
        .update(row)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await admin
      .from("payments")
      .upsert(row, { onConflict: "order_id" })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  });
}

async function ensureRunReadyForPaidPayment({ paymentId, tierKey, walletAddress, intent, failedRunId, rawStatus }) {
  if (!paymentId || !tierKey) return null;
  return withSupabaseAdmin("webhook_ensure_run_ready", async (admin) => {
    const { data: existingRun, error: lookupError } = await admin
      .from("runs")
      .select("*")
      .eq("payment_id", paymentId)
      .limit(1)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existingRun) {
      const status = String(existingRun.status || "").toLowerCase();
      if (status === "created") {
        const metadata = (existingRun.metadata && typeof existingRun.metadata === "object")
          ? existingRun.metadata
          : {};
        const { data: updatedRun, error: updateErr } = await admin
          .from("runs")
          .update({
            status: "ready",
            metadata: {
              ...metadata,
              webhookPromotedAt: new Date().toISOString(),
              webhookStatus: rawStatus,
              intent,
              failedRunId: intent === "restart" ? failedRunId : "",
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRun.id)
          .select("*")
          .single();
        if (updateErr) throw updateErr;
        return updatedRun;
      }
      return existingRun;
    }

    const runPayload = {
      run_id: newRunId(),
      wallet_address: walletAddress || "",
      tier: tierKey,
      status: "ready",
      payment_id: paymentId,
      result: "pending",
      metadata: {
        source: "nowpayments_webhook",
        webhookStatus: rawStatus,
        intent,
        failedRunId: intent === "restart" ? failedRunId : "",
        createdAt: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: createdRun, error: insertErr } = await admin
      .from("runs")
      .upsert(runPayload, { onConflict: "run_id" })
      .select("*")
      .single();
    if (insertErr) throw insertErr;
    return createdRun;
  });
}

async function writeAuditEvent({
  eventId,
  entityId,
  requestId,
  ip,
  beforeState,
  afterState,
  metadata,
}) {
  return withSupabaseAdmin("webhook_write_audit", async (admin) => {
    const { error } = await admin
      .from("admin_audit")
      .upsert(
        {
          event_id: eventId,
          actor: "system:nowpayments",
          action: "payment_webhook_processed",
          entity: "payment",
          entity_id: entityId || "",
          request_id: requestId || "",
          ip: ip || "",
          before_state: beforeState || null,
          after_state: afterState || null,
          metadata: metadata || {},
          created_at: new Date().toISOString(),
        },
        { onConflict: "event_id" }
      );
    if (error) throw error;
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!hasSupabaseAdminEnv()) {
    return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on server" });
  }

  const ipnSecret = String(
    process.env.NOWPAYMENTS_IPN_SECRET ||
    process.env.NOWPAYMENTS_WEBHOOK_SECRET ||
    ""
  ).trim();
  if (!ipnSecret) {
    return res.status(500).json({ error: "Missing NOWPAYMENTS_IPN_SECRET on server" });
  }

  try {
    const payloadObj = await parseWebhookBody(req);
    if (!payloadObj || typeof payloadObj !== "object") {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }

    const canonicalPayload = canonicalWebhookPayload(payloadObj);
    const providedSig = sanitizeText(
      req?.headers?.["x-nowpayments-sig"] ||
      req?.headers?.["x-nowpayments-signature"] ||
      "",
      512
    ).toLowerCase();
    if (!providedSig) {
      return res.status(401).json({ error: "Missing x-nowpayments-sig header" });
    }

    const computedSig = crypto.createHmac("sha512", ipnSecret).update(canonicalPayload).digest("hex");
    if (!timingSafeHexEq(computedSig, providedSig)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const eventHash = sha256Hex(canonicalPayload);
    const existingIdem = await getIdempotencyRecord(eventHash);
    if (existingIdem?.response_code && existingIdem?.response_body) {
      return res.status(Number(existingIdem.response_code)).json(existingIdem.response_body);
    }
    if (existingIdem?.locked_until && Date.parse(String(existingIdem.locked_until)) > Date.now()) {
      return res.status(202).json({ ok: true, deduped: true, processing: true });
    }
    await reserveIdempotencyRecord({ keyHash: eventHash });

    const paymentId = sanitizeText(payloadObj.payment_id || payloadObj.paymentId || "", 180);
    const orderId = sanitizeText(payloadObj.order_id || payloadObj.orderId || "", 220);
    const rawStatus = String(payloadObj.payment_status || payloadObj.status || "").toLowerCase();
    const normalizedStatus = normalizePaymentStatus(rawStatus);
    const tierKey = extractTierKeyFromOrderId(orderId);
    const intent = extractIntentFromOrderId(orderId);
    const failedRunId = intent === "restart" ? extractFailedRunIdFromOrderId(orderId) : "";
    const payAmount = toNumber(payloadObj.pay_amount ?? payloadObj.payAmount);
    const payCurrency = sanitizeText(payloadObj.pay_currency || payloadObj.payCurrency || "", 64).toLowerCase();
    const payAddress = sanitizeText(payloadObj.pay_address || payloadObj.payAddress || "", 240);
    const requestId = sanitizeText(req?.headers?.["x-request-id"] || "", 120);
    const sourceIp = readIp(req);

    if (!paymentId && !orderId) {
      const badResp = { error: "Missing payment_id/order_id in webhook payload" };
      await finalizeIdempotencyRecord({ keyHash: eventHash, statusCode: 400, body: badResp });
      return res.status(400).json(badResp);
    }

    const existingPayment = await findPaymentByIds({ paymentId, orderId });
    const updatedPayment = await upsertPaymentFromWebhook({
      existing: existingPayment,
      paymentId,
      orderId,
      tierKey,
      intent,
      normalizedStatus,
      payload: payloadObj,
      payAmount,
      payCurrency,
      walletAddress: sanitizeText(payloadObj.customer_wallet || payloadObj.wallet_address || payAddress, 180),
      email: sanitizeText(payloadObj.email || payloadObj.customer_email || "", 320).toLowerCase(),
    });

    let runRecord = null;
    if (normalizedStatus === "paid" && updatedPayment?.payment_id) {
      runRecord = await ensureRunReadyForPaidPayment({
        paymentId: updatedPayment.payment_id,
        tierKey: sanitizeText(updatedPayment.tier || tierKey, 64).toLowerCase(),
        walletAddress: sanitizeText(updatedPayment.wallet_address || "", 180),
        intent,
        failedRunId,
        rawStatus,
      });
    }

    await writeAuditEvent({
      eventId: `np_webhook_${eventHash}`,
      entityId: updatedPayment?.payment_id || updatedPayment?.order_id || paymentId || orderId,
      requestId,
      ip: sourceIp,
      beforeState: existingPayment || null,
      afterState: {
        payment_id: updatedPayment?.payment_id || null,
        order_id: updatedPayment?.order_id || null,
        status: updatedPayment?.status || normalizedStatus,
        run_id: runRecord?.run_id || null,
      },
      metadata: {
        source: "nowpayments_webhook",
        rawStatus,
        normalizedStatus,
        tierKey,
        intent,
        failedRunId,
      },
    });

    const okResp = {
      ok: true,
      deduped: false,
      payment_id: updatedPayment?.payment_id || paymentId || null,
      order_id: updatedPayment?.order_id || orderId || null,
      payment_status: rawStatus || normalizedStatus,
      normalized_status: normalizedStatus,
      tierKey: sanitizeText(updatedPayment?.tier || tierKey || "", 64).toLowerCase() || null,
      run_id: runRecord?.run_id || null,
    };
    await finalizeIdempotencyRecord({ keyHash: eventHash, statusCode: 200, body: okResp });
    return res.status(200).json(okResp);
  } catch (err) {
    return res.status(500).json({
      error: "Webhook handler error",
      details: String(err?.message || err || "unknown error"),
    });
  }
}
