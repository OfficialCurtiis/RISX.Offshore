import crypto from "crypto";

const SESSION_COOKIE = "risx_admin_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 8; // 8h

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const loginAttempts = new Map();

function b64urlEncode(input) {
  return Buffer.from(input).toString("base64url");
}

function b64urlDecode(input) {
  return Buffer.from(String(input || ""), "base64url").toString("utf8");
}

function timingSafeStringEq(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function parseCookies(req) {
  const raw = String(req?.headers?.cookie || "");
  const out = {};
  if (!raw) return out;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = decodeURIComponent(part.slice(i + 1).trim());
    out[k] = v;
  }
  return out;
}

function getIp(req) {
  const xff = req?.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }
  return String(req?.socket?.remoteAddress || "unknown");
}

function sign(body) {
  const secret = process.env.ADMIN_TOKEN;
  if (!secret) throw new Error("Missing ADMIN_TOKEN");
  return crypto.createHmac("sha256", secret).update(body).digest("base64url");
}

function parseAdminPasswordHash(raw) {
  const value = String(raw || "");
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return null;
  return { salt: parts[1], digestHex: parts[2].toLowerCase() };
}

export function verifyPassword(password) {
  const parsed = parseAdminPasswordHash(process.env.ADMIN_PASSWORD_HASH);
  if (!parsed) throw new Error("ADMIN_PASSWORD_HASH must be scrypt:<salt>:<hexDigest>");
  const derived = crypto.scryptSync(String(password || ""), parsed.salt, 64).toString("hex").toLowerCase();
  return timingSafeStringEq(derived, parsed.digestHex);
}

export function canAttemptLogin(req) {
  const ip = getIp(req);
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec) return { allowed: true, ip };

  if (now - rec.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return { allowed: true, ip };
  }

  if (rec.count >= LOGIN_MAX_ATTEMPTS) {
    const retryAfterSec = Math.max(1, Math.ceil((LOGIN_WINDOW_MS - (now - rec.windowStart)) / 1000));
    return { allowed: false, ip, retryAfterSec };
  }

  return { allowed: true, ip };
}

export function recordFailedLogin(req, reason = "invalid_credentials") {
  const ip = getIp(req);
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || (now - rec.windowStart > LOGIN_WINDOW_MS)) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
  } else {
    rec.count += 1;
    loginAttempts.set(ip, rec);
  }
  console.warn("[admin-login-failed]", {
    at: new Date(now).toISOString(),
    ip,
    reason,
  });
}

export function clearFailedLogins(req) {
  loginAttempts.delete(getIp(req));
}

export function createAdminSession() {
  const payload = {
    role: "admin",
    iat: Date.now(),
    exp: Date.now() + SESSION_MAX_AGE_SEC * 1000,
  };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function setAdminCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
  const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; ${secure}SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SEC}`;
  res.setHeader("Set-Cookie", cookie);
}

export function clearAdminCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; ${secure}SameSite=Strict; Max-Age=0`);
}

export function readAdminSession(req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[SESSION_COOKIE];
    if (!token) return null;

    const [body, sig] = String(token).split(".");
    if (!body || !sig) return null;
    if (!timingSafeStringEq(sign(body), sig)) return null;

    const payload = JSON.parse(b64urlDecode(body));
    if (!payload || payload.role !== "admin") return null;
    if (!Number(payload.exp) || Date.now() > Number(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAdmin(req, res) {
  const session = readAdminSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return session;
}

export function parseJsonBody(req) {
  if (req?.body && typeof req.body === "object") return req.body;
  if (typeof req?.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

export function getRequestIp(req) {
  return getIp(req);
}
