import crypto from "crypto";
import { verifyUnlockToken } from "./admin/_mint.js";
import { hasSupabaseAdminEnv, withSupabaseAdmin } from "./_supabaseAdmin.js";

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input || "")).digest("hex");
}

function sanitizeText(raw, maxLen = 180) {
  return String(raw || "").trim().slice(0, maxLen);
}

function normalizeIntent(intent) {
  return String(intent || "").toLowerCase() === "restart" ? "restart" : "entry";
}

async function findUnlockRowByJti(jti) {
  return withSupabaseAdmin("unlock_consume_find_unlock_jti", async (admin) => {
    const { data, error } = await admin
      .from("unlock_tokens")
      .select("*")
      .eq("jti", jti)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  });
}

async function upsertUnlockRow(row) {
  return withSupabaseAdmin("unlock_consume_upsert_unlock", async (admin) => {
    const { data, error } = await admin
      .from("unlock_tokens")
      .upsert(row, { onConflict: "jti" })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  });
}

async function consumeUnlockRow({ jti, runId }) {
  return withSupabaseAdmin("unlock_consume_mark_consumed", async (admin) => {
    const patch = {
      consumed_at: new Date().toISOString(),
      consumed_by: "client_start",
      updated_at: new Date().toISOString(),
    };
    if (runId) patch.run_id = runId;

    const { data, error } = await admin
      .from("unlock_tokens")
      .update(patch)
      .eq("jti", jti)
      .is("consumed_at", null)
      .select("*");
    if (error) throw error;
    return Array.isArray(data) ? data[0] || null : null;
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    if (!hasSupabaseAdminEnv()) {
      return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on server" });
    }

    const { token, tierKey: requestedTier, runId = "" } = req.body || {};
    if (!token) return res.status(400).json({ error: "Missing token" });

    const v = verifyUnlockToken(token);
    if (!v.ok) return res.status(401).json({ valid: false, expired: !!v.expired });

    const tokenTier = String(v.payload.tierKey || "").toLowerCase();
    const requestTier = String(requestedTier || "").toLowerCase();
    if (requestTier && requestTier !== tokenTier) {
      return res.status(409).json({ valid: false, consumed: false, error: "Tier mismatch" });
    }

    const jti = sanitizeText(v.payload.jti || "", 64);
    const tokenHash = sha256Hex(token);
    const normalizedIntent = normalizeIntent(v.payload.intent || "entry");
    const safeRunId = sanitizeText(runId, 120);
    const expiresAtMs = Number(v.payload.exp || 0);
    if (!jti || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return res.status(401).json({ valid: false, consumed: false, expired: true });
    }

    const existing = await findUnlockRowByJti(jti);
    if (existing) {
      const existingHash = String(existing.token_hash || "");
      if (existingHash && existingHash !== tokenHash) {
        return res.status(409).json({ valid: false, consumed: false, error: "Token fingerprint mismatch" });
      }
      if (existing.consumed_at) {
        const existingRunId = sanitizeText(existing.run_id || "", 120);
        if (!safeRunId || existingRunId === safeRunId) {
          return res.status(200).json({
            valid: true,
            consumed: true,
            alreadyConsumed: true,
            jti,
            tierKey: tokenTier,
            paymentId: String(v.payload.paymentId || ""),
            intent: normalizedIntent,
            failedRunId: String(v.payload.failedRunId || ""),
            exp: expiresAtMs,
            runId: existingRunId || null,
          });
        }
        return res.status(409).json({
          valid: true,
          consumed: false,
          error: "Token already consumed by another run",
          runId: existingRunId || null,
        });
      }
    }

    await upsertUnlockRow({
      jti,
      token_hash: tokenHash,
      run_id: safeRunId || existing?.run_id || null,
      payment_id: String(v.payload.paymentId || ""),
      tier: tokenTier,
      intent: normalizedIntent,
      expires_at: new Date(expiresAtMs).toISOString(),
      consumed_at: null,
      consumed_by: null,
      metadata: {
        failedRunId: String(v.payload.failedRunId || ""),
      },
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const consumed = await consumeUnlockRow({ jti, runId: safeRunId || null });
    if (!consumed) {
      const after = await findUnlockRowByJti(jti);
      const afterRunId = sanitizeText(after?.run_id || "", 120);
      if (after?.consumed_at && (!safeRunId || afterRunId === safeRunId)) {
        return res.status(200).json({
          valid: true,
          consumed: true,
          alreadyConsumed: true,
          jti,
          tierKey: tokenTier,
          paymentId: String(v.payload.paymentId || ""),
          intent: normalizedIntent,
          failedRunId: String(v.payload.failedRunId || ""),
          exp: expiresAtMs,
          runId: afterRunId || null,
        });
      }
      return res.status(409).json({
        valid: true,
        consumed: false,
        error: "Token was consumed concurrently",
      });
    }

    return res.status(200).json({
      valid: true,
      consumed: true,
      jti,
      tierKey: tokenTier,
      paymentId: String(v.payload.paymentId || ""),
      exp: expiresAtMs,
      intent: normalizedIntent,
      failedRunId: String(v.payload.failedRunId || ""),
      runId: sanitizeText(consumed.run_id || "", 120) || null,
    });
  } catch (e) {
    if (String(e?.message || "").includes("Missing RISX_ADMIN_KEY_CURRENT")) {
      return res.status(500).json({ error: "Missing RISX_ADMIN_KEY_CURRENT" });
    }
    return res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
}
