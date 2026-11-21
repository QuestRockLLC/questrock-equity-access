import { createHmac, timingSafeEqual } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
export const COOKIE = "equity_desk";

export async function loadEnv() {
  const paths = [join(ROOT, ".env.local"), join(ROOT, "../QRdashboard/.env.local")];
  for (const p of paths) {
    try {
      await access(p);
      const text = await readFile(p, "utf8");
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const i = t.indexOf("=");
        if (i < 1) continue;
        const k = t.slice(0, i).trim();
        let v = t.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!(k in process.env)) process.env[k] = v;
      }
    } catch {
      /* skip missing */
    }
  }
}

export function cfg() {
  return {
    supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, ""),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    deskUser: (process.env.EQUITY_DESK_USER || "concierge@questrock.com").toLowerCase(),
    deskPass: process.env.EQUITY_DESK_PASSWORD || "QuestRock01!",
    deskSecret: process.env.EQUITY_DESK_SECRET || "questrock-equity-desk-session",
  };
}

const PURPOSES = ["debt", "renovation", "flexibility", "investment", "other"];
const OCCUPANCY = ["primary", "secondary", "investment", "other"];
const PROPERTY = ["single_family", "townhouse", "condo", "two_four", "mixed_use", "commercial", "other"];
const AMOUNTS = ["10-49", "50-99", "100-249", "250-plus"];
const STATES = ["GA", "FL", "TN", "NC", "SC", "TX", "AL", "KY", "OTHER"];
const LICENSED = ["GA", "FL", "TN", "NC", "SC", "TX", "AL", "KY"];

export function str(v, max = 200) {
  return String(v ?? "").trim().slice(0, max);
}

function digits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function triage(lead) {
  const flags = [];
  const missing = ["purpose", "amount", "state", "occupancy", "propertyType", "valueRange", "balanceRange"].filter(
    (k) => !str(lead[k])
  );
  if (missing.length) {
    return { route: "NEEDS_INFORMATION", label: "Additional information", flags: ["Missing property or loan details"] };
  }
  if (!PURPOSES.includes(lead.purpose) || !OCCUPANCY.includes(lead.occupancy) || !PROPERTY.includes(lead.propertyType)) {
    return { route: "NEEDS_INFORMATION", label: "Additional information", flags: ["Unrecognized answer"] };
  }
  if (!LICENSED.includes(lead.state)) flags.push("State licensing and lender geographic coverage require verification");
  if (lead.occupancy === "investment" || lead.purpose === "investment") flags.push("Possible investor financing review");
  if (["mixed_use", "commercial", "other"].includes(lead.propertyType)) flags.push("Specialty or unusual property review");
  if (lead.valueRange === "unknown" || lead.balanceRange === "unknown") {
    flags.push("Property value or mortgage balance needs clarification");
  }
  if (lead.amount === "250-plus") flags.push("Requested line may require additional program review");
  if (flags.length) return { route: "LICENSED_REVIEW", label: "Licensed product review", flags };
  return { route: "AVEN_REVIEW", label: "Aven review candidate", flags };
}

export function validate(body) {
  const purpose = str(body.purpose, 40);
  const amount = str(body.amount, 40);
  const state = str(body.state || body.property_state, 8).toUpperCase();
  const occupancy = str(body.occupancy, 40);
  const propertyType = str(body.propertyType || body.property_type, 40);
  const valueRange = str(body.valueRange || body.value_range, 40);
  const balanceRange = str(body.balanceRange || body.balance_range, 40);
  const currentMortgage = str(body.currentMortgage || body.current_mortgage, 20);
  const firstName = str(body.firstName || body.first_name, 60);
  const lastName = str(body.lastName || body.last_name, 60);
  const email = str(body.email, 200).toLowerCase();
  const phone = digits(body.phone);
  const contact = str(body.contact || body.preferred_contact, 20) || "phone";
  const otherProducts = Boolean(body.otherProducts ?? body.other_products);
  const contactConsent = Boolean(body.contactConsent ?? body.contact_consent);

  if (!PURPOSES.includes(purpose) || !AMOUNTS.includes(amount) || !STATES.includes(state)) {
    return { error: "Please complete purpose, amount, and property state." };
  }
  if (!OCCUPANCY.includes(occupancy) || !PROPERTY.includes(propertyType)) {
    return { error: "Please complete occupancy and property type." };
  }
  if (!firstName || !lastName) return { error: "First and last name are required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "A valid email is required." };
  if (phone.length < 10) return { error: "A 10-digit phone number is required." };
  if (!contactConsent) return { error: "Contact authorization is required." };

  const lead = { purpose, amount, state, occupancy, propertyType, valueRange, balanceRange, currentMortgage };
  const route = triage(lead);
  return {
    row: {
      source: "QuestHELOC · Equity Access",
      status: "New inquiry",
      purpose,
      amount,
      property_state: state,
      occupancy,
      property_type: propertyType,
      value_range: valueRange,
      balance_range: balanceRange,
      current_mortgage: currentMortgage,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      preferred_contact: contact,
      other_products: otherProducts,
      contact_consent: contactConsent,
      route: route.route,
      route_label: route.label,
      flags: route.flags,
      payload: { instantly: false, aven: false, credit_decision: false },
    },
    route,
  };
}

export async function sb(path, { method = "GET", body } = {}) {
  const { supabaseUrl, serviceKey } = cfg();
  if (!supabaseUrl || !serviceKey) throw new Error("QuestRock Core Supabase env is missing.");
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Supabase ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function signSession(email, exp) {
  const payload = `${email}|${exp}`;
  const sig = createHmac("sha256", cfg().deskSecret).update(payload).digest("hex");
  return `${payload}|${sig}`;
}

export function validSession(token) {
  const parts = String(token || "").split("|");
  if (parts.length !== 3) return false;
  const [email, exp, sig] = parts;
  if (!email || !exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = createHmac("sha256", cfg().deskSecret).update(`${email}|${exp}`).digest("hex");
  try {
    return safeEqual(sig, expected) && safeEqual(email.toLowerCase(), cfg().deskUser);
  } catch {
    return false;
  }
}

export function sessionCookieValue(token, clear = false) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  if (clear) return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`;
}
