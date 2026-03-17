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
  const payload = {
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
  if (Date.now() > Number(payload.exp)) return { ok: false, expired: true };
  return { ok: true, payload };
}
