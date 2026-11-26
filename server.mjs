import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  COOKIE,
  ROOT,
  applyDeskAction,
  findStaff,
  loadEnv,
  parseCookies,
  postShape,
  sb,
  sessionCookieValue,
  signSession,
  str,
  validate,
  validSession,
} from "./lib/core.mjs";
import { resolveReferral } from "./lib/referral.mjs";

await loadEnv();

const PORT = Number(process.env.PORT || 8770);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".js": "text/javascript; charset=utf-8",
};

const PUBLIC_PREFIXES = ["/aven-ui/", "/app.js", "/styles.css", "/ea-design.css", "/hero.jpg", "/hero-home.jpg", "/why-home.jpg", "/questrock-logo.png"];

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function staffOk(req, res, { html } = {}) {
  const staff = validSession(parseCookies(req)[COOKIE]);
  if (staff) return staff;
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
  const clean = pathname.replace(/^\/public/, "") || "/";
  if (PUBLIC_PREFIXES.some((p) => clean === p || clean.startsWith("/aven-ui/"))) {
    return join(ROOT, "public", clean.replace(/^\//, ""));
  }
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
    if (req.method === "POST" && url.pathname === "/api/referral") {
      const body = await readJson(req);
      const result = resolveReferral({
        state: body.state,
        loHint: body.loHint || body.utm_content || body.lo,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      if (!result.ok) {
        res.end(JSON.stringify({ ok: false, code: result.code }));
        return;
      }
      res.end(JSON.stringify({
        ok: true,
        state: result.state,
        continueHost: "flow.avenfoundry.com",
        url: result.url,
      }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/inquiry") {
      const checked = validate(await readJson(req));
      if (checked.error) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: checked.error }));
        return;
      }
      const saved = await sb("equity_access_inquiries", { method: "POST", body: checked.row });
      const row = Array.isArray(saved) ? saved[0] : saved;
      const shape = await postShape(row || checked.row);
      if (row?.id) {
        await sb(`equity_access_inquiries?id=eq.${encodeURIComponent(row.id)}`, {
          method: "PATCH",
          body: { payload: { ...(row.payload || {}), shape } },
        });
      }
      console.log("equity-access saved", row?.id, checked.row.property_state, checked.row.purpose);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/desk-login") {
      const body = await readJson(req);
      const staff = findStaff(str(body.email, 200), String(body.password ?? ""));
      if (!staff) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "That email or password is not correct." }));
        return;
      }
      res.setHeader("Set-Cookie", sessionCookieValue(signSession(staff.email, staff.role, Date.now() + 86400 * 1000)));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, role: staff.role, name: staff.name }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const staff = staffOk(req, res);
      if (!staff) return;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, ...staff }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/inquiry-action") {
      const staff = staffOk(req, res);
      if (!staff) return;
      const body = await readJson(req);
      const id = str(body.id, 80);
      const rows = await sb(`equity_access_inquiries?id=eq.${encodeURIComponent(id)}&select=*`);
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Inquiry not found." }));
        return;
      }
      const next = applyDeskAction(row, str(body.action, 40), staff);
      if (next.error) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: next.error }));
        return;
      }
      const saved = await sb(`equity_access_inquiries?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { status: next.status, payload: next.payload },
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, row: Array.isArray(saved) ? saved[0] : saved }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/desk-logout") {
      res.setHeader("Set-Cookie", sessionCookieValue("", true));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/inquiries") {
      const staff = staffOk(req, res);
      if (!staff) return;
      const rows = await sb("equity_access_inquiries?select=*&order=created_at.desc&limit=100");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, rows: rows || [], staff }));
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
