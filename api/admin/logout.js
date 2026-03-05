import { clearAdminCookie } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    clearAdminCookie(res);
    return res.status(200).json({ authed: false, loggedOut: true });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
