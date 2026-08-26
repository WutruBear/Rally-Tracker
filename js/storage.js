// ---------------------------------------------------------------------------
// Persistence. IndexedDB is the primary store (bigger quota, survives more
// browser edge cases than localStorage); if it's unavailable (e.g. some
// private-browsing modes) we fall back to localStorage transparently.
//
// Schema is explicitly versioned. Add a migration function to SCHEMA_MIGRATIONS
// when you change the shape of stored data — no more inline
// `r.startAt != null ? r.startAt : r.startTime` patches scattered through
// the state bootstrap.
// ---------------------------------------------------------------------------

const DB_NAME = "rally-tracker";
const STORE = "kv";
const CURRENT_SCHEMA_VERSION = 1;

import * as idbKeyval from "./vendor/idb-keyval-bundle.js";

let idbBroken = false;

function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem("rallytracker:" + key);
    return v === null ? fallback : JSON.parse(v);
  } catch (e) {
    return fallback;
  }
}
function lsSet(key, value) {
  try {
    localStorage.setItem("rallytracker:" + key, JSON.stringify(value));
  } catch (e) {
    console.warn("[storage] localStorage write failed:", e);
  }
}

export async function get(key, fallback) {
  if (!idbBroken) {
    try {
      const v = await idbKeyval.get(key);
      return v === undefined ? fallback : v;
    } catch (e) {
      console.warn("[storage] idb get failed, falling back to localStorage:", e);
      idbBroken = true;
    }
  }
  return lsGet(key, fallback);
}

export async function set(key, value) {
  if (!idbBroken) {
    try {
      await idbKeyval.set(key, value);
      return;
    } catch (e) {
      console.warn("[storage] idb set failed, falling back to localStorage:", e);
      idbBroken = true;
    }
  }
  lsSet(key, value);
}

// ---- schema migrations ----------------------------------------------------
// Each migration takes the full { roster, rallies, groups } bundle at
// version N and returns it upgraded to version N+1.

const SCHEMA_MIGRATIONS = {
  // Example shape for the next time the data model changes:
  // 1: (data) => ({ ...data, rallies: data.rallies.map(r => ({ ...r, foo: "bar" })) }),
};

export async function loadAll() {
  const version = await get("schemaVersion", 0);
  let data = {
    roster: await get("roster", []),
    rallies: await get("rallies", []),
    groups: await get("groups", []),
  };

  // One-time migration from the pre-versioned single-file app, where
  // rallies used `startTime` instead of `startAt`.
  data.rallies = data.rallies.map((r) => ({
    ...r,
    startAt: r.startAt != null ? r.startAt : r.startTime,
  }));
  data.roster = data.roster.map((p) => ({
    ...p,
    alliance: (p.alliance || "").trim() || "Unassigned",
  }));
  data.groups = data.groups.map((g) => ({
    mode: "now",
    targetTime: "",
    launchDelay: 0,
    memberIds: [],
    ...g,
  }));

  let v = version;
  while (v < CURRENT_SCHEMA_VERSION) {
    const migrate = SCHEMA_MIGRATIONS[v];
    if (migrate) data = migrate(data);
    v += 1;
  }
  if (v !== version) await set("schemaVersion", v);

  return data;
}

export async function saveAll({ roster, rallies, groups }) {
  await Promise.all([
    set("roster", roster),
    set("rallies", rallies),
    set("groups", groups),
    set("schemaVersion", CURRENT_SCHEMA_VERSION),
  ]);
}

export async function exportBackup({ roster, rallies, groups }) {
  return JSON.stringify(
    { schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: new Date().toISOString(), roster, rallies, groups },
    null,
    2
  );
}

export function parseBackup(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data.roster) || !Array.isArray(data.rallies) || !Array.isArray(data.groups)) {
    throw new Error("Backup file is missing roster/rallies/groups arrays.");
  }
  return { roster: data.roster, rallies: data.rallies, groups: data.groups };
}
