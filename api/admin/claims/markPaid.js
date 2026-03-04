import { getRequestIp, parseJsonBody, requireAdmin } from "../_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!requireAdmin(req, res)) return;

  try {
    const { claimId, status = "PAID", txid = "" } = parseJsonBody(req);
    if (!claimId) return res.status(400).json({ error: "Missing claimId" });

    const normalized = String(status || "").toUpperCase();
    if (!["PAID", "VOID"].includes(normalized)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    console.info("[admin-claim-mark]", {
      at: new Date().toISOString(),
      ip: getRequestIp(req),
      claimId: String(claimId),
      status: normalized,
      txid: String(txid || ""),
    });

    // NOTE: Persist to your DB here (this repo currently has no server DB layer).
    return res.status(200).json({
      ok: true,
      claimId: String(claimId),
      status: normalized,
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
