// /api/verify-token.js
import crypto from "crypto";
import { signRunResumeToken, verifyRunResumeToken, verifyUnlockToken } from "./admin/_mint.js";
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
  return withSupabaseAdmin("verify_token_find_unlock_jti", async (admin) => {
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
  return withSupabaseAdmin("verify_token_upsert_unlock", async (admin) => {
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
  return withSupabaseAdmin("verify_token_consume_unlock", async (admin) => {
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
    const { mode = "", token, consume = false, tierKey: requestedTier, runId = "", resumeToken = "", liveBalance, status: runStatus } = req.body || {};

    if (String(mode || "").toLowerCase() === "sync_run") {
      if (!hasSupabaseAdminEnv()) {
        return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on server" });
      }
      const vr = verifyRunResumeToken(String(resumeToken || ""));
      if (!vr.ok) return res.status(401).json({ ok: false, error: "Invalid or expired resume token", expired: !!vr.expired });

      const tokenRunId = sanitizeText(vr.payload.runId, 120);
      const bodyRunId = sanitizeText(runId, 120);
      if (bodyRunId && bodyRunId !== tokenRunId) {
        return res.status(409).json({ ok: false, error: "runId mismatch" });
      }

      const nextBalance = Number(liveBalance);
      const clampedBalance = Number.isFinite(nextBalance) ? Math.max(0, Math.round(nextBalance * 100) / 100) : null;
      const nextStatusRaw = String(runStatus || "").toLowerCase();
      const syncStatus = ["active", "resumed", "ready"].includes(nextStatusRaw) ? nextStatusRaw : null;

      const updatedRun = await withSupabaseAdmin("verify_token_sync_run", async (admin) => {
        const { data: existing, error: findErr } = await admin
          .from("runs")
          .select("*")
          .eq("run_id", tokenRunId)
          .limit(1)
          .maybeSingle();
        if (findErr) throw findErr;
        if (!existing) return null;

        const existingPaymentId = String(existing.payment_id || "");
        if (existingPaymentId && existingPaymentId !== String(vr.payload.paymentId || "")) {
          throw new Error("payment mismatch");
        }

        const metadata = (existing.metadata && typeof existing.metadata === "object") ? existing.metadata : {};
        const patch = {
          updated_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            liveBalance: clampedBalance ?? metadata.liveBalance ?? null,
            lastClientSyncAt: new Date().toISOString(),
          },
        };
        if (syncStatus) patch.status = syncStatus;

        const { data: updated, error: updateErr } = await admin
          .from("runs")
          .update(patch)
          .eq("run_id", tokenRunId)
          .select("*")
          .single();
        if (updateErr) throw updateErr;
        return updated;
      });

      if (!updatedRun) return res.status(404).json({ ok: false, error: "Run not found" });

      const returnedLiveBalanceRaw = updatedRun?.metadata?.liveBalance ?? clampedBalance;
      const returnedLiveBalance = Number.isFinite(Number(returnedLiveBalanceRaw))
        ? Math.max(0, Math.round(Number(returnedLiveBalanceRaw) * 100) / 100)
        : null;

      return res.status(200).json({
        ok: true,
        synced: true,
        runId: String(updatedRun.run_id || tokenRunId),
        paymentId: String(updatedRun.payment_id || vr.payload.paymentId || ""),
        tierKey: String(updatedRun.tier || vr.payload.tierKey || ""),
        status: String(updatedRun.status || syncStatus || ""),
        liveBalance: returnedLiveBalance,
      });
    }

    if (!token) return res.status(400).json({ error: "Missing token" });

    const v = verifyUnlockToken(token);
    if (!v.ok) return res.status(401).json({ valid: false, expired: !!v.expired });

    const tokenTier = String(v.payload.tierKey || "").toLowerCase();
    const requestTier = String(requestedTier || "").toLowerCase();
    if (requestTier && requestTier !== tokenTier) {
      return res.status(409).json({ valid: false, error: "Tier mismatch" });
    }

    if (consume) {
      if (!hasSupabaseAdminEnv()) {
        return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on server" });
      }

      const jti = sanitizeText(v.payload.jti || "", 64);
      const tokenHash = sha256Hex(token);
      const normalizedIntent = normalizeIntent(v.payload.intent || "entry");
      const safeRunId = sanitizeText(runId, 120);
      const expiresAtMs = Number(v.payload.exp || 0);
      if (!jti || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
        return res.status(401).json({ valid: false, expired: true });
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
            const resumeExp = Date.now() + 1000 * 60 * 60 * 24 * 7;
            const resumeTokenOut = signRunResumeToken({
              runId: existingRunId || safeRunId || "",
              paymentId: String(v.payload.paymentId || ""),
              tierKey: tokenTier,
              exp: resumeExp,
            });
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
              resume_token: resumeTokenOut,
              resume_token_expires_at: resumeExp,
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
          const resumeExp = Date.now() + 1000 * 60 * 60 * 24 * 7;
          const resumeToken = signRunResumeToken({
            runId: afterRunId || safeRunId || "",
            paymentId: String(v.payload.paymentId || ""),
            tierKey: tokenTier,
            exp: resumeExp,
          });
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
            resume_token: resumeToken,
            resume_token_expires_at: resumeExp,
          });
        }
        return res.status(409).json({
          valid: true,
          consumed: false,
          error: "Token was consumed concurrently",
        });
      }

      const resumeExp = Date.now() + 1000 * 60 * 60 * 24 * 7;
      const nextRunId = sanitizeText(consumed.run_id || "", 120) || safeRunId || "";
      const resumeTokenOut = signRunResumeToken({
        runId: nextRunId,
        paymentId: String(v.payload.paymentId || ""),
        tierKey: tokenTier,
        exp: resumeExp,
      });
      return res.status(200).json({
        valid: true,
        consumed: true,
        jti,
        tierKey: tokenTier,
        paymentId: String(v.payload.paymentId || ""),
        exp: expiresAtMs,
        intent: normalizedIntent,
        failedRunId: String(v.payload.failedRunId || ""),
        runId: nextRunId || null,
        resume_token: resumeTokenOut,
        resume_token_expires_at: resumeExp,
      });
    }

    return res.status(200).json({
      valid: true,
      tierKey: tokenTier,
      paymentId: v.payload.paymentId,
      exp: v.payload.exp,
      jti: String(v.payload.jti || ""),
      intent: ["entry", "restart"].includes(String(v.payload.intent || "").toLowerCase())
        ? String(v.payload.intent).toLowerCase()
        : "entry",
      failedRunId: String(v.payload.failedRunId || ""),
    });
  } catch (e) {
    if (String(e?.message || "").includes("Missing RISX_ADMIN_KEY_CURRENT")) {
      return res.status(500).json({ error: "Missing RISX_ADMIN_KEY_CURRENT" });
    }
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
