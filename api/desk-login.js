import { findStaff, loadEnv, sessionCookieValue, signSession, str } from "../lib/core.mjs";

await loadEnv();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }
  const body = req.body || {};
  const staff = findStaff(str(body.email, 200), String(body.password ?? ""));
  if (!staff) {
    res.status(401).json({ ok: false, error: "That email or password is not correct." });
    return;
  }
  const exp = Date.now() + 86400 * 1000;
  res.setHeader("Set-Cookie", sessionCookieValue(signSession(staff.email, staff.role, exp)));
  res.status(200).json({ ok: true, role: staff.role, name: staff.name });
}
