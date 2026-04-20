// /api/verify-payment.js
import { signRunResumeToken, signUnlockToken } from "./admin/_mint.js";
import { hasSupabaseAdminEnv, withSupabaseAdmin } from "./_supabaseAdmin.js";

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

function normalizeDbStatus(status = "") {
  const s = String(status || "").toLowerCase();
  if (["pending", "paid", "expired", "cancelled", "failed"].includes(s)) return s;
  if (s === "confirmed" || s === "finished") return "paid";
  return "pending";
}

function normalizeProviderStatus(status = "") {
  const s = String(status || "").toLowerCase();
  if (s === "confirmed" || s === "finished" || s === "paid") return "paid";
  if (s === "expired") return "expired";
  if (s === "cancelled") return "cancelled";
  if (s === "failed" || s === "refunded") return "failed";
  return "pending";
}

function dbStatusToClientPaymentStatus(dbStatus = "", providerStatus = "") {
  const rawProvider = String(providerStatus || "").toLowerCase();
  if (rawProvider) return rawProvider;
  const s = normalizeDbStatus(dbStatus);
  if (s === "paid") return "finished";
  return s;
}

function isPaidStatus(status = "") {
  const s = String(status || "").toLowerCase();
  return s === "confirmed" || s === "finished" || s === "paid";
}

async function findConsumedUnlockByPaymentId(paymentId) {
  const id = String(paymentId || "").trim();
  if (!id) return null;
  return withSupabaseAdmin("verify_payment_unlock_consumed_by_payment", async (admin) => {
    const { data, error } = await admin
      .from("unlock_tokens")
      .select("jti,run_id,consumed_at,payment_id")
      .eq("payment_id", id)
      .not("consumed_at", "is", null)
      .order("consumed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  });
}

function parseJsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function parseRunLiveBalance(runRow) {
  const metadata = parseJsonObject(runRow?.metadata);
  const raw = Number(metadata.liveBalance ?? metadata.balance ?? null);
  if (!Number.isFinite(raw)) return null;
  return Math.max(0, Math.round(raw * 100) / 100);
}

function normalizeLiveBalance(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  return Math.max(0, Math.round(raw * 100) / 100);
}

function toEpochMs(value) {
  if (!value) return 0;
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return n;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isTerminalRunStatus(status) {
  const s = String(status || "").toLowerCase();
  return ["failed", "won", "claimed", "paid", "void"].includes(s);
}

async function fetchRunRowByRunId(runId) {
  const id = String(runId || "").trim();
  if (!id) return null;
  return withSupabaseAdmin("verify_payment_fetch_run_row", async (admin) => {
    const { data, error } = await admin
      .from("runs")
      .select("*")
      .eq("run_id", id)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  });
}

function buildResumeRunPayload(runRow, fallback = {}) {
  const metadata = parseJsonObject(runRow?.metadata);
  const runId = String(runRow?.run_id || fallback.runId || "").trim();
  if (!runId) return null;
  const fallbackLiveBalance = normalizeLiveBalance(fallback.liveBalance ?? fallback.live_balance ?? null);
  const runLiveBalance = parseRunLiveBalance(runRow);
  const runFreshness = Math.max(
    toEpochMs(metadata.lastClientSyncAt),
    toEpochMs(runRow?.updated_at),
    toEpochMs(runRow?.ended_at),
    toEpochMs(runRow?.started_at)
  );
  const fallbackFreshness = Math.max(
    toEpochMs(fallback.updatedAt),
    toEpochMs(fallback.lastClientSyncAt),
    toEpochMs(fallback.consumedAt)
  );
  const resolvedLiveBalance =
    fallbackLiveBalance !== null && fallbackFreshness > runFreshness
      ? fallbackLiveBalance
      : (runLiveBalance ?? fallbackLiveBalance);
  return {
    run_id: runId,
    payment_id: String(runRow?.payment_id || fallback.paymentId || "").trim() || null,
    tierKey: String(runRow?.tier || fallback.tierKey || "").toLowerCase() || null,
    status: String(runRow?.status || fallback.status || "").toLowerCase() || null,
    started_at: runRow?.started_at || fallback.startedAt || null,
    ended_at: runRow?.ended_at || fallback.endedAt || null,
    result: runRow?.result ?? metadata.result ?? null,
    pnl: runRow?.pnl ?? metadata.pnl ?? null,
    live_balance: resolvedLiveBalance,
    updated_at: (fallbackFreshness > runFreshness ? fallback.updatedAt : null) || runRow?.updated_at || fallback.updatedAt || null,
  };
}

async function buildConsumedResumeData(consumedUnlock, fallback = {}) {
  const runId = String(consumedUnlock?.run_id || "").trim();
  if (!runId) return null;

  let runRow = null;
  try {
    runRow = await fetchRunRowByRunId(runId);
  } catch {
    runRow = null;
  }

  const paymentId = String(runRow?.payment_id || fallback.paymentId || consumedUnlock?.payment_id || "").trim();
  const tierKey = String(runRow?.tier || fallback.tierKey || "").toLowerCase();
  const unlockMetadata = parseJsonObject(consumedUnlock?.metadata);
  const resumeRun = buildResumeRunPayload(runRow, {
    runId,
    paymentId,
    tierKey,
    status: String(unlockMetadata.status || unlockMetadata.runStatus || "").toLowerCase(),
    liveBalance: unlockMetadata.liveBalance,
    updatedAt: unlockMetadata.lastClientSyncAt || consumedUnlock?.updated_at || null,
    lastClientSyncAt: unlockMetadata.lastClientSyncAt || null,
    consumedAt: consumedUnlock?.updated_at || consumedUnlock?.consumed_at || null,
  });
  const runIsTerminal = isTerminalRunStatus(runRow?.status || resumeRun?.status || "");

  if (!paymentId || !tierKey || runIsTerminal) {
    return resumeRun ? { resume_run: resumeRun } : null;
  }

  const resumeExp = Date.now() + 1000 * 60 * 60 * 24 * 7;
  return {
    resume_token: signRunResumeToken({
      runId,
      paymentId,
      tierKey,
      exp: resumeExp,
    }),
    resume_token_expires_at: resumeExp,
    resume_run: resumeRun,
  };
}

async function fetchPaymentRow(paymentId) {
  return withSupabaseAdmin("verify_payment_fetch_row", async (admin) => {
    const { data, error } = await admin
      .from("payments")
      .select("*")
      .eq("payment_id", paymentId)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  });
}

async function upsertPaymentFromProvider(existingRow, data = {}) {
  const orderId = String(data?.order_id || existingRow?.order_id || "").trim();
  const paymentId = String(data?.payment_id || existingRow?.payment_id || "").trim();
  const normalized = normalizeProviderStatus(data?.payment_status || existingRow?.status || "pending");
  const row = {
    order_id: orderId || `verify_${paymentId}_${Date.now()}`,
    payment_id: paymentId || null,
    wallet_address: String(existingRow?.wallet_address || ""),
    email: String(existingRow?.email || ""),
    tier: extractTierKeyFromOrderId(orderId) || String(existingRow?.tier || "beginner"),
    intent: extractIntentFromOrderId(orderId) || String(existingRow?.intent || "entry"),
    status: normalized,
    amount_usd: Number(data?.price_amount ?? existingRow?.amount_usd ?? 0) || null,
    pay_amount: Number(data?.pay_amount ?? existingRow?.pay_amount ?? 0) || null,
    pay_currency: String(data?.pay_currency || existingRow?.pay_currency || ""),
    provider: "nowpayments",
    provider_payload: data || existingRow?.provider_payload || {},
    paid_at: normalized === "paid" ? new Date().toISOString() : (existingRow?.paid_at || null),
    updated_at: new Date().toISOString(),
  };

  return withSupabaseAdmin("verify_payment_upsert_provider", async (admin) => {
    if (existingRow?.id) {
      const { data: updated, error } = await admin
        .from("payments")
        .update(row)
        .eq("id", existingRow.id)
        .select("*")
        .single();
      if (error) throw error;
      return updated;
    }

    const { data: inserted, error } = await admin
      .from("payments")
      .upsert(row, { onConflict: "payment_id" })
      .select("*")
      .single();
    if (error) throw error;
    return inserted;
  });
}

function buildResponseFromPaymentRow(row = {}) {
  const providerPayload = (row?.provider_payload && typeof row.provider_payload === "object")
    ? row.provider_payload
    : {};
  const orderId = String(providerPayload?.order_id || row?.order_id || "");
  const paymentStatus = dbStatusToClientPaymentStatus(row?.status, providerPayload?.payment_status);
  const tierKey = extractTierKeyFromOrderId(orderId) || String(row?.tier || "").toLowerCase() || null;
  const intent = extractIntentFromOrderId(orderId) || String(row?.intent || "entry").toLowerCase();
  const failedRunId = intent === "restart" ? extractFailedRunIdFromOrderId(orderId) : "";

  return {
    payment_id: String(row?.payment_id || ""),
    payment_status: paymentStatus,
    actually_paid: providerPayload?.actually_paid ?? row?.pay_amount ?? null,
    pay_amount: providerPayload?.pay_amount ?? row?.pay_amount ?? null,
    pay_currency: providerPayload?.pay_currency ?? row?.pay_currency ?? null,
    order_id: orderId || null,
    tierKey,
    intent,
    failedRunId,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  try {
    const { payment_id } = req.query || {};
    if (!payment_id) return res.status(400).json({ error: "Missing payment_id" });
    const paymentId = String(payment_id || "").trim();

    let paymentRow = null;
    if (hasSupabaseAdminEnv()) {
      paymentRow = await fetchPaymentRow(paymentId);
      if (paymentRow) {
        const dbStatus = normalizeDbStatus(paymentRow.status);
        // DB-first: if we already know terminal truth, return immediately.
        if (["paid", "expired", "cancelled", "failed"].includes(dbStatus)) {
          const out = buildResponseFromPaymentRow(paymentRow);
          let consumedUnlock = null;
          if (hasSupabaseAdminEnv()) {
            consumedUnlock = await findConsumedUnlockByPaymentId(out.payment_id || paymentId);
          }
          if (isPaidStatus(out.payment_status) && out.tierKey && !consumedUnlock) {
            const exp = Date.now() + 1000 * 60 * 60 * 24;
            out.unlock_token = signUnlockToken({
              tierKey: out.tierKey,
              paymentId: String(out.payment_id || paymentId),
              exp,
              intent: out.intent,
              failedRunId: out.failedRunId,
            });
            out.unlock_expires_at = exp;
          } else if (consumedUnlock) {
            out.unlock_consumed = true;
            out.unlock_consumed_at = consumedUnlock.consumed_at || null;
            out.consumed_run_id = consumedUnlock.run_id || null;
            const resume = await buildConsumedResumeData(consumedUnlock, {
              paymentId: String(out.payment_id || paymentId),
              tierKey: out.tierKey || null,
            });
            if (resume?.resume_token) out.resume_token = resume.resume_token;
            if (resume?.resume_token_expires_at) out.resume_token_expires_at = resume.resume_token_expires_at;
            if (resume?.resume_run) out.resume_run = resume.resume_run;
          }
          return res.status(200).json(out);
        }
      }
    }

    // Fallback/reconciliation path: query provider when DB is missing or still pending.
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) {
      if (paymentRow) {
        const out = buildResponseFromPaymentRow(paymentRow);
        return res.status(200).json(out);
      }
      return res.status(500).json({ error: "Missing NOWPAYMENTS_API_KEY on server" });
    }

    const providerRes = await fetch(`https://api.nowpayments.io/v1/payment/${encodeURIComponent(paymentId)}`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
    });

    const providerData = await providerRes.json();
    if (!providerRes.ok) {
      if (paymentRow) {
        const out = buildResponseFromPaymentRow(paymentRow);
        return res.status(200).json(out);
      }
      return res.status(400).json({ error: "NOWPayments error", details: providerData });
    }

    if (hasSupabaseAdminEnv()) {
      paymentRow = await upsertPaymentFromProvider(paymentRow, providerData);
    }

    const tierKey = extractTierKeyFromOrderId(providerData.order_id);
    const intent = extractIntentFromOrderId(providerData.order_id);
    const failedRunId = intent === "restart" ? extractFailedRunIdFromOrderId(providerData.order_id) : "";
    const statusLower = String(providerData.payment_status || "").toLowerCase();

    const out = {
      payment_id: providerData.payment_id,
      payment_status: providerData.payment_status,
      actually_paid: providerData.actually_paid,
      pay_amount: providerData.pay_amount,
      pay_currency: providerData.pay_currency,
      order_id: providerData.order_id,
      tierKey,
      intent,
      failedRunId,
    };

    let consumedUnlock = null;
    if (hasSupabaseAdminEnv()) {
      consumedUnlock = await findConsumedUnlockByPaymentId(String(providerData.payment_id || paymentId));
    }
    if (isPaidStatus(statusLower) && tierKey && !consumedUnlock) {
      const exp = Date.now() + 1000 * 60 * 60 * 24;
      out.unlock_token = signUnlockToken({
        tierKey,
        paymentId: String(providerData.payment_id || paymentId),
        exp,
        intent,
        failedRunId,
      });
      out.unlock_expires_at = exp;
    } else if (consumedUnlock) {
      out.unlock_consumed = true;
      out.unlock_consumed_at = consumedUnlock.consumed_at || null;
      out.consumed_run_id = consumedUnlock.run_id || null;
      const resume = await buildConsumedResumeData(consumedUnlock, {
        paymentId: String(providerData.payment_id || paymentId),
        tierKey: tierKey || null,
      });
      if (resume?.resume_token) out.resume_token = resume.resume_token;
      if (resume?.resume_token_expires_at) out.resume_token_expires_at = resume.resume_token_expires_at;
      if (resume?.resume_run) out.resume_run = resume.resume_run;
    }
    return res.status(200).json(out);
  } catch (e) {
    if (String(e?.message || "").includes("Missing RISX_ADMIN_KEY_CURRENT")) {
      return res.status(500).json({ error: "Missing RISX_ADMIN_KEY_CURRENT" });
    }
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
