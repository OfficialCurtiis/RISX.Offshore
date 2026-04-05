import crypto from "crypto";

function getCurrentMintKey() {
  const key = String(process.env.RISX_ADMIN_KEY_CURRENT || "");
  if (!key) throw new Error("Missing RISX_ADMIN_KEY_CURRENT");
  return key;
}

export function getMintKeyStatus() {
  return {
    hasCurrent: !!process.env.RISX_ADMIN_KEY_CURRENT,
    hasPrevious: !!process.env.RISX_ADMIN_KEY_PREVIOUS,
  };
}

export function signUnlockToken({ tierKey, paymentId, exp, intent = "entry", failedRunId = "" }) {
  const normalizedIntent = String(intent || "").toLowerCase() === "restart" ? "restart" : "entry";
  const iat = Date.now();
  const payload = {
    jti: crypto.randomUUID(),
    iat,
    tierKey,
    paymentId,
    exp,
    intent: normalizedIntent,
    failedRunId: normalizedIntent === "restart" ? String(failedRunId || "") : "",
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getCurrentMintKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyUnlockToken(token) {
  const current = String(process.env.RISX_ADMIN_KEY_CURRENT || "");
  if (!current) throw new Error("Missing RISX_ADMIN_KEY_CURRENT");

  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return { ok: false };

  const expected = crypto.createHmac("sha256", current).update(body).digest("base64url");
  if (expected !== sig) return { ok: false };

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false };
  }

  if (!payload?.tierKey || !payload?.paymentId || !payload?.exp) return { ok: false };
  if (payload.intent && !["entry", "restart"].includes(String(payload.intent).toLowerCase())) return { ok: false };
  if (!payload.jti) {
    // Backward compatibility for older tokens minted before jti support.
    payload.jti = crypto.createHash("sha256").update(body).digest("hex").slice(0, 32);
  }
  if (Date.now() > Number(payload.exp)) return { ok: false, expired: true };
  return { ok: true, payload };
}

export function signRunResumeToken({ runId, paymentId, tierKey, exp }) {
  const payload = {
    typ: "run_resume",
    runId: String(runId || ""),
    paymentId: String(paymentId || ""),
    tierKey: String(tierKey || "").toLowerCase(),
    iat: Date.now(),
    exp: Number(exp || 0),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getCurrentMintKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyRunResumeToken(token) {
  const current = String(process.env.RISX_ADMIN_KEY_CURRENT || "");
  if (!current) throw new Error("Missing RISX_ADMIN_KEY_CURRENT");

  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return { ok: false };

  const expected = crypto.createHmac("sha256", current).update(body).digest("base64url");
  if (expected !== sig) return { ok: false };

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false };
  }

  if (!payload || payload.typ !== "run_resume") return { ok: false };
  if (!payload.runId || !payload.paymentId || !payload.tierKey || !payload.exp) return { ok: false };
  if (Date.now() > Number(payload.exp)) return { ok: false, expired: true };
  return { ok: true, payload };
}
