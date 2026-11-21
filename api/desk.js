import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { COOKIE, loadEnv, parseCookies, ROOT, validSession } from "../lib/core.mjs";

await loadEnv();

export default async function handler(req, res) {
  if (!validSession(parseCookies(req)[COOKIE])) {
    res.writeHead(302, { Location: "/desk/login" });
    res.end();
    return;
  }
  const file = await readFile(join(ROOT, "desk.html"));
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).end(file);
}
