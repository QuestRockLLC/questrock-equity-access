import { COOKIE, applyDeskAction, loadEnv, parseCookies, sb, str, validSession } from "../lib/core.mjs";

await loadEnv();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }
  const staff = validSession(parseCookies(req)[COOKIE]);
  if (!staff) {
    res.status(401).json({ ok: false, error: "Sign in required" });
    return;
  }
  const body = req.body || {};
  const id = str(body.id, 80);
  const action = str(body.action, 40);
  if (!id) {
    res.status(400).json({ ok: false, error: "Missing inquiry." });
    return;
  }
  try {
    const rows = await sb(`equity_access_inquiries?id=eq.${encodeURIComponent(id)}&select=*`);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) {
      res.status(404).json({ ok: false, error: "Inquiry not found." });
      return;
    }
    const next = applyDeskAction(row, action, staff);
    if (next.error) {
      res.status(403).json({ ok: false, error: next.error });
      return;
    }
    const saved = await sb(`equity_access_inquiries?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { status: next.status, payload: next.payload },
    });
    res.status(200).json({ ok: true, row: Array.isArray(saved) ? saved[0] : saved });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: "Could not update inquiry.", detail: err.data || String(err.message || err) });
  }
}
