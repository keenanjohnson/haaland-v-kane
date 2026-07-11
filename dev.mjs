// Local dev server — mimics just enough of Vercel to run the site + /api/match.
//
//   node --env-file=.env.local dev.mjs
//
// Put SPORTMONKS_TOKEN=... in .env.local (gitignored). Without a token the
// API returns { ok:false } and the page falls back to simulation, same as prod.

import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matchHandler from "./api/match.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/api/match") {
    // minimal Vercel function adapter
    const vreq = { query: Object.fromEntries(url.searchParams) };
    const vres = {
      setHeader: (k, v) => res.setHeader(k, v),
      status(c) { res.statusCode = c; return this; },
      json(body) { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(body)); return this; },
    };
    try {
      await matchHandler(vreq, vres);
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ ok: false, reason: String(e) }));
    }
    return;
  }

  let p = url.pathname === "/" ? "/index.html" : url.pathname;
  try {
    const body = await readFile(path.join(ROOT, path.normalize(p).replace(/^([.]{2}[/\\])+/, "")));
    res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(PORT, () => {
  console.log(`Impact-o-meter dev server → http://localhost:${PORT}`);
  console.log(`SPORTMONKS_TOKEN: ${process.env.SPORTMONKS_TOKEN ? "set ✓" : "NOT SET — /api/match will return ok:false (sim fallback)"}`);
});
