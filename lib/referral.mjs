/** Verified public Instantly HELOC Aven flows. Do not invent identifiers. */
export const LO_REFERRAL_URLS = Object.freeze({
  nikk: "https://flow.avenfoundry.com?i=287af627-a89f-4d90-8885-a094c2fe5dca",
  ray: "https://flow.avenfoundry.com?i=768f7940-c88b-4196-8e9b-68d5dcba67c4",
  bill: "https://flow.avenfoundry.com?i=85f645e3-9cb9-4971-8b71-0a7e55f2ce54",
});

export const ALLOWED_AVEN_HOSTS = Object.freeze(["flow.avenfoundry.com"]);

export const SUPPORTED_STATES = Object.freeze(["GA", "FL", "TN", "NC", "SC", "TX", "AL", "KY"]);

export const LO_KEYS = Object.freeze(["nikk", "ray", "bill"]);

/**
 * Instantly enrollment used exclusive LO only for KY and TX (Bill).
 * Overlapping states still honor utm_content. Unattributed public visits
 * use Nikk’s verified flow so licensed states can continue.
 */
export const EXCLUSIVE_STATE_LO = Object.freeze({
  KY: "bill",
  TX: "bill",
});

export const DEFAULT_LO = "nikk";

function asState(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function asLo(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isAllowedReferralUrl(urlString) {
  try {
    const url = new URL(String(urlString || ""));
    if (url.protocol !== "https:") return false;
    if (!ALLOWED_AVEN_HOSTS.includes(url.hostname)) return false;
    if (url.username || url.password) return false;
    return true;
  } catch {
    return false;
  }
}

export function resolveReferral({ state, loHint } = {}) {
  const st = asState(state);
  if (!st) return { ok: false, code: "blank" };
  if (!/^[A-Z]{2}$/.test(st)) return { ok: false, code: "invalid" };
  if (!SUPPORTED_STATES.includes(st)) return { ok: false, code: "unsupported" };

  let lo = asLo(loHint);
  if (lo && !LO_KEYS.includes(lo)) return { ok: false, code: "invalid" };

  const exclusive = EXCLUSIVE_STATE_LO[st] || null;
  if (!lo && exclusive) lo = exclusive;
  if (!lo) lo = DEFAULT_LO;
  if (exclusive && lo !== exclusive) return { ok: false, code: "unmapped" };

  const url = LO_REFERRAL_URLS[lo];
  if (!isAllowedReferralUrl(url)) return { ok: false, code: "rejected" };
  return { ok: true, state: st, lo, url };
}
