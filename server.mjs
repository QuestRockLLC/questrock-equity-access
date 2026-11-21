import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import {
  COOKIE,
  ROOT,
  cfg,
  loadEnv,
  parseCookies,
  safeEqual,
  sb,
  sessionCookieValue,
  signSession,
  str,
  validate,
  validSession,
} from "./lib/core.mjs";

await loadEnv();

const PORT = Number(process.env.PORT || 8770);
const { deskUser, deskPass } = cfg();

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const ASSETS = new Set(["styles.css", "hero.jpg", "why-home.jpg", "questrock-logo.png"]);

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
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

function filePathFor(pathname) {
  if (pathname === "/" || pathname === "/index.html") return join(ROOT, "public", "index.html");
  if (pathname === "/login.html") return join(ROOT, "public", "login.html");
  const name = basename(pathname.replace(/^\/public\//, "/"));
  if (ASSETS.has(name)) return join(ROOT, "public", name);
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
      const checked = validate(await readJson(req));
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
      if (!safeEqual(email, deskUser) || !safeEqual(password, deskPass)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "That email or password is not correct." }));
        return;
      }
      res.setHeader("Set-Cookie", sessionCookieValue(signSession(email, Date.now() + 86400 * 1000)));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/desk-logout") {
      res.setHeader("Set-Cookie", sessionCookieValue("", true));
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
      const file = await readFile(join(ROOT, "public", "login.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(file);
      return;
    }

    if (url.pathname === "/desk" || url.pathname === "/staff") {
      if (!staffOk(req, res, { html: true })) return;
      const file = await readFile(join(ROOT, "desk.html"));
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

const host = process.env.VERCEL ? "0.0.0.0" : "127.0.0.1";
server.listen(PORT, host, () => {
  console.log(`Equity Access http://${host}:${PORT}/`);
  console.log(`Staff submissions http://${host}:${PORT}/desk`);
});
