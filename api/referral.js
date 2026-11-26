import { resolveReferral } from "../lib/referral.mjs";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, code: "method" });
    return;
  }

  const body = req.body || {};
  const result = resolveReferral({
    state: body.state,
    loHint: body.loHint || body.utm_content || body.lo,
  });

  if (!result.ok) {
    res.status(200).json({ ok: false, code: result.code });
    return;
  }

  res.status(200).json({
    ok: true,
    state: result.state,
    continueHost: "flow.avenfoundry.com",
    url: result.url,
  });
}
