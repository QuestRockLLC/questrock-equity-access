import { COOKIE, loadEnv, parseCookies, sb, validSession } from "../lib/core.mjs";

await loadEnv();

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false });
    return;
  }
  const staff = validSession(parseCookies(req)[COOKIE]);
  if (!staff) {
    res.status(401).json({ ok: false, error: "Sign in required" });
    return;
  }
  try {
    const rows = await sb("equity_access_inquiries?select=*&order=created_at.desc&limit=100");
    res.status(200).json({ ok: true, rows: rows || [], staff });
  } catch (err) {
    res.status(err.status || 500).json({
      ok: false,
      error: "Could not save or load inquiries.",
      detail: err.data || String(err.message || err),
    });
  }
}
