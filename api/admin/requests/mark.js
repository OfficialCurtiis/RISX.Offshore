import { getRequestIp, parseJsonBody, requireAdmin } from "../_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!requireAdmin(req, res)) return;

  try {
    const { id, kind, status } = parseJsonBody(req);
    if (!id) return res.status(400).json({ error: "Missing id" });

    const normalizedKind = String(kind || "").toLowerCase();
    if (!["deposit", "withdraw"].includes(normalizedKind)) {
      return res.status(400).json({ error: "Invalid kind" });
    }

    const normalizedStatus = String(status || "").toUpperCase();
    if (!["PAID", "VOID"].includes(normalizedStatus)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    console.info("[admin-request-mark]", {
      at: new Date().toISOString(),
      ip: getRequestIp(req),
      id: String(id),
      kind: normalizedKind,
      status: normalizedStatus,
    });

    // NOTE: Persist to your DB here (this repo currently has no server DB layer).
    return res.status(200).json({ ok: true, id: String(id), kind: normalizedKind, status: normalizedStatus });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
