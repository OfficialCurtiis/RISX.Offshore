import { readAdminSession } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  try {
    const session = readAdminSession(req);
    if (!session) return res.status(200).json({ authed: false });
    return res.status(200).json({ authed: true, role: "admin" });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
