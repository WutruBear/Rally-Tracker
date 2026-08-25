// ---------------------------------------------------------------------------
// Pure domain logic. Nothing in this file touches the DOM, localStorage, or
// Date.now() implicitly — every function that needs "now" takes it as an
// argument. That's what makes it unit-testable (see tests/model.test.js).
// ---------------------------------------------------------------------------

export const RALLY_BUFFER = 5 * 60; // seconds every rally spends "forming" before it can march

export const TEAM_META = {
  ally: { label: "OUR STATE", accent: "#3FD6C7", icon: "\u{1F6E1}\uFE0F" },
  enemy: { label: "ENEMY STATE", accent: "#E1594F", icon: "\u2694\uFE0F" },
};

// ---- parsing / formatting ----------------------------------------------

export function parseMarchInput(str) {
  str = (str || "").trim();
  if (!str) return NaN;
  if (str.includes(":")) {
    const parts = str.split(":");
    if (parts.length !== 2) return NaN;
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (isNaN(m) || isNaN(s) || s < 0 || s > 59 || m < 0) return NaN;
    return m * 60 + s;
  }
  const n = parseInt(str, 10);
  return isNaN(n) ? NaN : n;
}

export function parseUTCTimeToday(str, now = Date.now()) {
  str = (str || "").trim();
  const m = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = parseInt(m[1], 10), mm = parseInt(m[2], 10), ss = m[3] ? parseInt(m[3], 10) : 0;
  if (hh > 23 || mm > 59 || ss > 59) return null;
  const d = new Date(now);
  let target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh, mm, ss);
  if (target <= now) target += 24 * 60 * 60 * 1000;
  return target;
}

export function fmtMMSS(totalSeconds) {
  const sign = totalSeconds < 0 ? "-" : "";
  const t = Math.abs(Math.round(totalSeconds));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return sign + m + ":" + String(s).padStart(2, "0");
}

export function fmtClockUTC(date) {
  return date.toLocaleTimeString("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ---- rally state machine -------------------------------------------------
// A rally is always in exactly one of these phases, derived purely from
// timestamps — no stored flags to keep in sync.

export const RallyPhase = Object.freeze({
  SCHEDULED: "scheduled", // hasn't started marching yet (startAt is in the future)
  MARCHING: "marching",   // marching toward the target, hasn't hit yet
  HIT: "hit",             // has hit the target
});

export function rallyPhase(r, now = Date.now()) {
  if (r.startAt && now < r.startAt) return RallyPhase.SCHEDULED;
  if (now >= r.hitTime) return RallyPhase.HIT;
  return RallyPhase.MARCHING;
}

export function getRallyTimerState(r, now = Date.now()) {
  const phase = rallyPhase(r, now);
  const isScheduled = phase === RallyPhase.SCHEDULED;
  const hasHit = phase === RallyPhase.HIT;
  const elapsed = (now - r.startAt) / 1000;
  const rallyRemaining = RALLY_BUFFER - elapsed;
  const hitRemaining = (r.hitTime - now) / 1000;
  const rallyDone = rallyRemaining <= 0;
  const imminent = phase === RallyPhase.MARCHING && hitRemaining <= 10;
  const secsUntilStart = isScheduled ? (r.startAt - now) / 1000 : 0;
  const imminentStart = isScheduled && secsUntilStart <= 10;
  return {
    phase, isScheduled, hasHit, elapsed, rallyRemaining, hitRemaining, rallyDone,
    imminent, secsUntilStart, imminentStart,
    borderColor: hasHit ? "#E1594F" : "#1D2523",
    rallyColor: rallyDone ? "#3E4A46" : "#8A948F",
    hitColor: hasHit ? "#E1594F" : "#F2A93B",
  };
}

export function getCountdownState(targetTs, now = Date.now()) {
  const secs = (targetTs - now) / 1000;
  return { secs, late: secs < -1, startNow: secs >= -1 && secs <= 0 };
}

// ---- ordering --------------------------------------------------------
// Soonest hit always on top. When several rallies share the exact same hit
// time (a synced group), the one that started earliest — and so has been
// marching the longest — goes on top.

export function sortRallies(rallies) {
  return [...rallies].sort((a, b) => {
    const diff = a.hitTime - b.hitTime;
    if (diff !== 0) return diff;
    return (a.startAt || 0) - (b.startAt || 0);
  });
}

// ---- rally / group construction (still pure — takes "now" explicitly) ----

export function buildRally(person, { startAt, hitTime, groupId } = {}, now = Date.now()) {
  const start = startAt != null ? startAt : now;
  const hit = hitTime != null ? hitTime : start + (RALLY_BUFFER + person.marchTime) * 1000;
  return {
    personId: person.id,
    name: person.name,
    team: person.team,
    alliance: person.alliance || "Unassigned",
    marchTime: person.marchTime,
    startAt: start,
    hitTime: hit,
    ...(groupId != null ? { groupId } : {}),
  };
}

// Compute the { personId -> {startAt, hitTime} } launch plan for a sync
// group without mutating anything or touching the id counter — pure.
export function planGroupLaunch(members, { mode, targetTime, launchDelay }, now = Date.now()) {
  const totals = members.map((p) => ({ ...p, total: RALLY_BUFFER + p.marchTime }));
  let hitTs;
  if (mode === "target") {
    hitTs = parseUTCTimeToday(targetTime, now);
    if (hitTs == null) return null;
  } else {
    const maxTotal = Math.max(...totals.map((p) => p.total));
    hitTs = now + ((Number(launchDelay) || 0) + maxTotal) * 1000;
  }
  return totals.map((p) => ({
    person: p,
    startAt: hitTs - p.total * 1000,
    hitTime: hitTs,
  }));
}
