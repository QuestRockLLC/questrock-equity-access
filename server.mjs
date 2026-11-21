import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile, access } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 8770);

async function loadEnv() {
  const paths = [
    join(DIR, ".env.local"),
    join(DIR, "../QRdashboard/.env.local"),
  ];
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

await loadEnv();

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DESK_USER = (process.env.EQUITY_DESK_USER || "concierge@questrock.com").toLowerCase();
const DESK_PASS = process.env.EQUITY_DESK_PASSWORD || "QuestRock01!";
const DESK_SECRET = process.env.EQUITY_DESK_SECRET || "questrock-equity-desk-session";
const COOKIE = "equity_desk";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const PURPOSES = ["debt", "renovation", "flexibility", "investment", "other"];
const OCCUPANCY = ["primary", "secondary", "investment", "other"];
const PROPERTY = ["single_family", "townhouse", "condo", "two_four", "mixed_use", "commercial", "other"];
const AMOUNTS = ["10-49", "50-99", "100-249", "250-plus"];
const STATES = ["GA", "FL", "TN", "NC", "SC", "TX", "AL", "KY", "OTHER"];
const LICENSED = ["GA", "FL", "TN", "NC", "SC", "TX", "AL", "KY"];

function str(v, max = 200) {
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
    return {
      route: "NEEDS_INFORMATION",
      label: "Additional information",
      flags: ["Missing property or loan details"],
    };
  }
  if (!PURPOSES.includes(lead.purpose) || !OCCUPANCY.includes(lead.occupancy) || !PROPERTY.includes(lead.propertyType)) {
    return {
      route: "NEEDS_INFORMATION",
      label: "Additional information",
      flags: ["Unrecognized answer"],
    };
  }
  if (!LICENSED.includes(lead.state)) flags.push("State licensing and lender geographic coverage require verification");
  if (lead.occupancy === "investment" || lead.purpose === "investment") flags.push("Possible investor financing review");
  if (["mixed_use", "commercial", "other"].includes(lead.propertyType)) flags.push("Specialty or unusual property review");
  if (lead.valueRange === "unknown" || lead.balanceRange === "unknown") {
    flags.push("Property value or mortgage balance needs clarification");
  }
  if (lead.amount === "250-plus") flags.push("Requested line may require additional program review");
  if (flags.length) {
    return { route: "LICENSED_REVIEW", label: "Licensed product review", flags };
  }
  return { route: "AVEN_REVIEW", label: "Aven review candidate", flags };
}

function validate(body) {
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

  const lead = {
    purpose,
    amount,
    state,
    occupancy,
    propertyType,
    valueRange,
    balanceRange,
    currentMortgage,
  };
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

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  return JSON.parse(raw);
}

async function sb(path, { method = "GET", body } = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("QuestRock Core Supabase env is missing.");
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=representation",
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

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function signSession(email, exp) {
  const payload = `${email}|${exp}`;
  const sig = createHmac("sha256", DESK_SECRET).update(payload).digest("hex");
  return `${payload}|${sig}`;
}

function validSession(token) {
  const parts = String(token || "").split("|");
  if (parts.length !== 3) return false;
  const [email, exp, sig] = parts;
  if (!email || !exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = createHmac("sha256", DESK_SECRET).update(`${email}|${exp}`).digest("hex");
  try {
    return safeEqual(sig, expected) && safeEqual(email.toLowerCase(), DESK_USER);
  } catch {
    return false;
  }
}

function staffOk(req, res, { html } = {}) {
  if (validSession(parseCookies(req)[COOKIE])) return true;
  if (html) {
    res.writeHead(302, { Location: "/desk/login" });
    res.end();
    return false;
  }
  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Sign in required" }));
  return false;
}

function setSessionCookie(res, token) {
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=86400",
  ];
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function filePathFor(pathname) {
  if (pathname === "/" || pathname === "/index.html") return join(DIR, "index.html");
  if (pathname.startsWith("/public/")) return join(DIR, pathname.replace(/^\/+/, ""));
  return null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.method === "POST" && url.pathname === "/api/inquiry") {
      const body = await readJson(req);
      const checked = validate(body);
      if (checked.error) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: checked.error }));
        return;
      }
      const saved = await sb("equity_access_inquiries", { method: "POST", body: checked.row });
      const row = Array.isArray(saved) ? saved[0] : saved;
      console.log("equity-access saved", row?.id, checked.row.property_state, checked.row.purpose);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/desk-login") {
      const body = await readJson(req);
      const email = str(body.email, 200).toLowerCase();
      const password = String(body.password ?? "");
      if (!safeEqual(email, DESK_USER) || !safeEqual(password, DESK_PASS)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "That email or password is not correct." }));
        return;
      }
      const exp = Date.now() + 86400 * 1000;
      setSessionCookie(res, signSession(email, exp));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/desk-logout") {
      clearSessionCookie(res);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/inquiries") {
      if (!staffOk(req, res)) return;
      const rows = await sb("equity_access_inquiries?select=*&order=created_at.desc&limit=100");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, rows: rows || [] }));
      return;
    }

    if (url.pathname === "/desk/login") {
      if (validSession(parseCookies(req)[COOKIE])) {
        res.writeHead(302, { Location: "/desk" });
        res.end();
        return;
      }
      const file = await readFile(join(DIR, "login.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(file);
      return;
    }

    if (url.pathname === "/desk" || url.pathname === "/staff") {
      if (!staffOk(req, res, { html: true })) return;
      const file = await readFile(join(DIR, "desk.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(file);
      return;
    }

    const disk = filePathFor(url.pathname);
    if (!disk) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const file = await readFile(disk);
    res.writeHead(200, { "Content-Type": TYPES[extname(disk)] || "text/plain" });
    res.end(file);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    console.error(err);
    res.writeHead(err.status || 500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Could not save or load inquiries.", detail: err.data || String(err.message || err) }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Equity Access http://127.0.0.1:${PORT}/`);
  console.log(`Staff submissions http://127.0.0.1:${PORT}/desk`);
});
