import { COOKIE, loadEnv, parseCookies, validSession } from "../lib/core.mjs";

await loadEnv();

export default async function handler(req, res) {
  const staff = validSession(parseCookies(req)[COOKIE]);
  if (!staff) {
    res.status(401).json({ ok: false });
    return;
  }
  res.status(200).json({ ok: true, ...staff });
}
