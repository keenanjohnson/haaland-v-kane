# ⚔️ THE IMPACT-O-METER: Haaland vs Kane

A single-page, boxing-poster-style **live impact meter** comparing Erling Haaland and Harry Kane during the **Norway vs England World Cup quarter-final** — Saturday 11 July 2026, Miami Stadium, kickoff **10pm BST / 5pm EDT / 11pm CEST**.

Built to be shared in group chats before/during the match. The joke: Haaland famously does almost nothing for 85 minutes and then wins the game. The meter takes this extremely seriously.

## The concept

- **Tale-of-the-tape layout**: Haaland on the left (Norway red/navy), Kane on the right (England white/red), big animated IMPACT gauges for each.
- **Deliberately absurd weighting**: goals move the needle enormously; touches, passes and "general involvement" barely register. One Haaland goal should slam his gauge into a zone labelled **VIKING**.
- **Live ticker** at the bottom with dry commentary generated from real events, e.g. *"Min 63: Haaland records his 9th touch. Norway remain calm."*
- **Bonus stats row** that mixes real data (shots, touches, duels) with fake ones ("times described as 'a machine' by opponent: 1").

## Architecture

```
/               static frontend (single index.html, no build step)
/api/match.js   serverless function (Vercel) — proxies Sportmonks, hides token, caches ~15s
```

- **Frontend**: plain HTML/CSS/JS. Polls `/api/match` every 20–30s. Two modes:
  - `SIMULATION` (default until a key is configured) — scripted fake match so the page always works and can be demoed before kickoff.
  - `LIVE` — real data via the proxy.
- **Data source**: [Sportmonks Football API v3](https://docs.sportmonks.com) — World Cup 2026 package. Paid plans include a one-time 14-day free trial. Live scores/events update within seconds; player-level stats (touches, passes, shots, duels) exist as stat types — **verify they populate in-play for this tournament before relying on them** (see CLAUDE.md → Data fallbacks).
- **Hosting**: Vercel (or Netlify). One env var: `SPORTMONKS_TOKEN`.

## Deploying

The site is safe to deploy before anything is configured — it starts in
simulation mode and always renders something funny.

### Why there's an `/api` function (the viral-traffic story)

The browser never talks to Sportmonks. It polls `/api/match`, a Vercel
serverless function that holds the token and does the real API call:

```
browser → /api/match (token lives here, cached) → Sportmonks
```

Two cache layers mean even viral traffic barely touches Sportmonks:

- The function sets `Cache-Control: s-maxage=15`, so Vercel's edge CDN
  answers most requests without invoking the function at all.
- Warm function instances also cache the Sportmonks response in memory
  for ~15s.

10,000 simultaneous viewers ≈ a handful of Sportmonks calls per 15s —
far under the ~3,000/hour plan limit. If Sportmonks errors or
rate-limits anyway, the function serves its stale cache; if everything
is on fire, the frontend falls back to the scripted simulation with a
`SIMULATION*` badge. The page never looks broken.

### 1. Push to GitHub

```bash
git add -A
git commit -m "Build the Impact-o-meter"
git push origin main
```

### 2. Import into Vercel (once, ~2 minutes)

1. Go to [vercel.com/new](https://vercel.com/new), sign in with GitHub,
   import `keenanjohnson/haaland-v-kane`.
2. Framework preset **Other**. No build command, no output directory —
   Vercel serves `index.html` statically and auto-detects `api/match.js`
   as a serverless function.
3. Under **Environment Variables**, add `SPORTMONKS_TOKEN` = your token
   from sportmonks.com (World Cup 2026 plan; one-time 14-day trial
   available). You can add it later in Project → Settings →
   Environment Variables, but you must redeploy for it to take effect.
4. Deploy. You get `https://<project>.vercel.app` immediately, and every
   push to `main` auto-deploys in ~20s from then on.

CLI alternative (no GitHub integration):
`npx vercel login && npx vercel --prod`, then
`npx vercel env add SPORTMONKS_TOKEN production` and deploy again.

### 3. Pre-kickoff checklist (this afternoon, in order)

1. **Find the fixture ID** for Norway vs England:
   `GET https://api.sportmonks.com/v3/football/fixtures/date/2026-07-11`
   (with `Authorization: <token>`), note the `id`.
2. **Dress rehearsal on a real live match** (France vs Spain plays
   earlier today): put *that* fixture ID in `config.js`, set
   `MODE: "LIVE"`, push, and watch the page. If touches show real
   numbers, player stats populate in-play for this tournament; if they
   show `est. (few)`, we're on the events rung of the fallback ladder —
   which is fine, that's part of the joke.
3. **Point it at tonight's game**: set the real fixture ID, keep
   `MODE: "LIVE"`, push.
4. Share link. Row.

### Testing locally with a real token

Put your token in `.env.local` (gitignored — never commit it):

```
SPORTMONKS_TOKEN=your_token_here
```

then run

```bash
node --env-file=.env.local dev.mjs
```

and open http://localhost:3000. `dev.mjs` serves the static site and runs
`api/match.js` the same way Vercel does. With no/empty token the API
returns `ok:false` and the page falls back to simulation — identical to
prod behaviour. To exercise LIVE mode locally, set `MODE: "LIVE"` (and a
fixture ID) in `config.js`.

### Kill switch

If live data misbehaves mid-match, set `MODE: "SIMULATION"` in
`config.js` and push — ~20s later every new visitor (and any refreshed
tab) gets the scripted match. Already-open tabs keep polling until
refreshed; if the API is truly down they fall back to simulation on
their own after two failed polls.

## Deadline

Kickoff is **tonight at 10pm BST**. Ship something funny that works over something perfect. Simulation mode is the safety net — the page must never look broken to someone opening the link, even if the API dies mid-match.

## Not affiliated

Fan-made joke site. Not affiliated with FIFA, the FA, NFF, or either large striker.
