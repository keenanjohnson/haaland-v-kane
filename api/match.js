// /api/match — the ONLY thing that talks to Sportmonks.
// Holds SPORTMONKS_TOKEN (env var), caches ~15s, returns a trimmed shape.
// Every failure path returns { ok: false } with HTTP 200 — the frontend
// treats that as "fall back to simulation", never as an error to display.

const BASE = "https://api.sportmonks.com/v3/football";

// One include-loaded call gets everything. We load `.type` relations so we
// can match stat/event kinds by developer_name string instead of guessing
// numeric type IDs (see CLAUDE.md: do not guess the Touches ID).
const INCLUDES =
  "events.type;statistics;lineups.details.type;participants;periods;state;scores";

// developer_name → our stat key. Verified names from
// https://docs.sportmonks.com/v3/definitions/types/statistics — matching is
// case-insensitive and tolerant of underscores/spaces/hyphens.
const STAT_NAMES = {
  goals: "goals",
  assists: "assists",
  shots_on_target: "shots_on_target",
  shots_total: "shots_total",
  touches: "touches",
  passes: "passes",
  accurate_passes: "passes_accurate",
  duels_won: "duels_won",
  total_duels: "duels_total",
};

const GOAL_EVENTS = new Set(["goal", "penalty", "owngoal"]);

// Module-level cache survives between invocations on a warm lambda.
let cache = { at: 0, body: null };
let discoveredFixtureId = null;
const CACHE_MS = 15000;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");

  const token = process.env.SPORTMONKS_TOKEN;
  if (!token) return res.status(200).json({ ok: false, reason: "no_token" });

  if (cache.body && Date.now() - cache.at < CACHE_MS) {
    return res.status(200).json(cache.body);
  }

  try {
    let fixtureId = req.query.fixture || discoveredFixtureId;
    if (!fixtureId) fixtureId = await discoverFixture(token);
    if (!fixtureId) return res.status(200).json({ ok: false, reason: "no_fixture" });
    discoveredFixtureId = fixtureId;

    const data = await sportmonks(
      `${BASE}/fixtures/${fixtureId}?include=${INCLUDES}`,
      token
    );
    const body = trim(data.data);
    cache = { at: Date.now(), body };
    return res.status(200).json(body);
  } catch (err) {
    // Serve stale cache through a blip rather than degrading the page.
    if (cache.body) return res.status(200).json(cache.body);
    return res.status(200).json({ ok: false, reason: String(err.message || err) });
  }
}

async function discoverFixture(token) {
  const data = await sportmonks(
    `${BASE}/livescores/inplay?include=participants`,
    token
  );
  const match = (data.data || []).find((f) => {
    const names = (f.participants || []).map((p) => (p.name || "").toLowerCase());
    return (
      names.some((n) => n.includes("norway")) &&
      names.some((n) => n.includes("england"))
    );
  });
  return match ? match.id : null;
}

async function sportmonks(url, token) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      headers: { Authorization: token },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`sportmonks_${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// ---- shaping ---------------------------------------------------------------

function trim(fx) {
  if (!fx) return { ok: false, reason: "empty_fixture" };

  const teams = {}; // participant_id → "norway" | "england"
  for (const p of fx.participants || []) {
    const n = (p.name || "").toLowerCase();
    if (n.includes("norway")) teams[p.id] = "norway";
    else if (n.includes("england")) teams[p.id] = "england";
  }

  const score = { norway: 0, england: 0 };
  for (const s of fx.scores || []) {
    if (s.description !== "CURRENT") continue;
    const side = teams[s.participant_id ?? s.score?.participant_id];
    const goals = s.score?.goals ?? 0;
    if (side) score[side] = goals;
  }

  const events = (fx.events || [])
    .map((e) => ({
      minute: e.minute ?? 0,
      added: e.extra_minute ?? null,
      type: norm(e.type?.developer_name || e.type?.name || ""),
      player: e.player_name || null,
      related: e.related_player_name || null,
      team: teams[e.participant_id] || null,
      result: e.result || null,
    }))
    .sort((a, b) => a.minute - b.minute || (a.added || 0) - (b.added || 0));

  const strikers = {
    haaland: strikerFrom(fx, teams, /haaland/i, events),
    kane: strikerFrom(fx, teams, /\bkane\b/i, events),
  };

  const quality = strikers.haaland.has_stats || strikers.kane.has_stats
    ? "player_stats"
    : events.length > 0
      ? "events"
      : "score_only";

  return {
    ok: true,
    mode: "live",
    quality,
    phase: phaseFrom(fx.state?.developer_name || ""),
    minute: minuteFrom(fx),
    score,
    strikers,
    events: events.slice(-40),
  };
}

function strikerFrom(fx, teams, nameRe, events) {
  const out = {
    on_pitch: false,
    has_stats: false,
    goals: 0,
    assists: 0,
    shots_on_target: null,
    shots_total: null,
    touches: null,
    passes: null,
    duels_won: null,
    yellow: 0,
    red: 0,
  };

  // Level 2 of the ladder — always derivable from events.
  for (const e of events) {
    const mine = e.player && nameRe.test(e.player);
    const assisted = e.related && nameRe.test(e.related);
    if (GOAL_EVENTS.has(e.type) && mine && e.type !== "owngoal") out.goals++;
    if (GOAL_EVENTS.has(e.type) && assisted) out.assists++;
    if (e.type.includes("yellow") && mine) out.yellow++;
    if (e.type.includes("red") && mine) out.red++;
  }

  // Level 1 — per-player lineup details, if this tournament populates them.
  for (const lp of fx.lineups || []) {
    if (!nameRe.test(lp.player_name || "")) continue;
    out.on_pitch = true;
    for (const d of lp.details || []) {
      const key = STAT_NAMES[norm(d.type?.developer_name || d.type?.name || "")];
      if (!key) continue;
      const value = d.data?.value ?? d.value;
      if (typeof value === "number") {
        out[key === "passes_accurate" ? "passes" : key] = value;
        out.has_stats = true;
      }
    }
  }
  return out;
}

function phaseFrom(state) {
  const s = norm(state);
  if (!s || s === "ns" || s.includes("delayed")) return "pre";
  if (s.includes("penalties")) return "pens";
  if (s.includes("et") && s.includes("inplay")) return "et";
  if (s === "ht" || s.includes("halftime") || s.includes("break")) return "ht";
  if (s.includes("2nd")) return "second_half";
  if (s.includes("1st")) return "first_half";
  if (s === "ft" || s.includes("finished") || s.includes("aet") || s.includes("ft_pen"))
    return "ft";
  return "second_half"; // in-play but unrecognised — assume the meter matters
}

function minuteFrom(fx) {
  const ticking = (fx.periods || []).find((p) => p.ticking);
  if (ticking) return ticking.minutes ?? 0;
  const last = (fx.periods || []).slice(-1)[0];
  return last?.minutes ?? 0;
}

function norm(s) {
  return String(s).toLowerCase().replace(/[\s-]+/g, "_");
}
