import {
  canAttemptLogin,
  clearFailedLogins,
  createAdminSession,
  parseJsonBody,
  recordFailedLogin,
  setAdminCookie,
  verifyPassword,
} from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const limiter = canAttemptLogin(req);
    if (!limiter.allowed) {
      return res.status(429).json({
        error: "Too many failed login attempts",
        retryAfterSec: limiter.retryAfterSec,
      });
    }

    const { password } = parseJsonBody(req);
    if (!password) {
      recordFailedLogin(req, "missing_password");
      return res.status(400).json({ error: "Missing password" });
    }

    const ok = verifyPassword(password);
    if (!ok) {
      recordFailedLogin(req, "invalid_password");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    clearFailedLogins(req);
    const token = createAdminSession();
    setAdminCookie(res, token);
    return res.status(200).json({ authed: true });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
