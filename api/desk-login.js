import { cfg, loadEnv, safeEqual, sessionCookieValue, signSession, str } from "../lib/core.mjs";

await loadEnv();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }
  const { deskUser, deskPass } = cfg();
  const body = req.body || {};
  const email = str(body.email, 200).toLowerCase();
  const password = String(body.password ?? "");
  if (!safeEqual(email, deskUser) || !safeEqual(password, deskPass)) {
    res.status(401).json({ ok: false, error: "That email or password is not correct." });
    return;
  }
  const exp = Date.now() + 86400 * 1000;
  res.setHeader("Set-Cookie", sessionCookieValue(signSession(email, exp)));
  res.status(200).json({ ok: true });
}
