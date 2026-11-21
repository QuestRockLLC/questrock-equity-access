import { loadEnv, validate, sb } from "../lib/core.mjs";

await loadEnv();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "POST only" });
    return;
  }
  try {
    const checked = validate(req.body || {});
    if (checked.error) {
      res.status(400).json({ ok: false, error: checked.error });
      return;
    }
    await sb("equity_access_inquiries", { method: "POST", body: checked.row });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({
      ok: false,
      error: "Could not save or load inquiries.",
      detail: err.data || String(err.message || err),
    });
  }
}
