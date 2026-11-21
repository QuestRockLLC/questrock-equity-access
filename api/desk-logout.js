import { sessionCookieValue } from "../lib/core.mjs";

export default async function handler(req, res) {
  res.setHeader("Set-Cookie", sessionCookieValue("", true));
  res.status(200).json({ ok: true });
}
