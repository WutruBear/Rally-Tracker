import { signal, computed, batch } from "https://esm.sh/@preact/signals@1?deps=preact@10";
import * as storage from "./storage.js";
import { RALLY_BUFFER, buildRally, planGroupLaunch, sortRallies, parseMarchInput, fmtClockUTC } from "./model.js";

// ---- id generation ---------------------------------------------------
let idCounter = 1;
function nextId() {
  return idCounter++;
}

// ---- core signals ----------------------------------------------------
export const roster = signal([]);
export const rallies = signal([]);
export const groups = signal([]);
export const now = signal(Date.now());

export const draft = signal({
  ally: { name: "", march: "", alliance: "" },
  enemy: { name: "", march: "", alliance: "" },
});
export const editDraft = signal(null);
export const pendingDelete = signal(null);
export const expanded = signal({});
export const groupExpanded = signal({});
export const groupEditor = signal(null);
export const backupNotice = signal(null); // { kind: "ok"|"error", text }

// Rallies within 2 minutes of hitting stay visible; older ones drop off the
// live list automatically as `now` ticks forward.
const RALLY_RETENTION_MS = 2 * 60 * 1000;

export const visibleRallies = computed(() =>
  rallies.value.filter((r) => now.value - r.hitTime < RALLY_RETENTION_MS)
);
export const sortedRallies = computed(() => sortRallies(visibleRallies.value));

let loaded = false;
export async function init() {
  const data = await storage.loadAll();
  idCounter =
    1 +
    Math.max(
      0,
      ...data.roster.map((p) => p.id),
      ...data.rallies.map((r) => r.id),
      ...data.groups.map((g) => g.id)
    );
  batch(() => {
    roster.value = data.roster;
    rallies.value = data.rallies;
    groups.value = data.groups;
  });
  loaded = true;
  setInterval(() => {
    now.value = Date.now();
  }, 1000);
}

function persist() {
  if (!loaded) return; // never overwrite storage with empty initial state
  storage.saveAll({ roster: roster.value, rallies: rallies.value, groups: groups.value });
}

// ---- roster actions -----------------------------------------------------

export function updateDraft(team, field, value) {
  draft.value = { ...draft.value, [team]: { ...draft.value[team], [field]: value } };
}

export function addPerson(team) {
  const d = draft.value[team];
  const name = d.name.trim();
  const seconds = parseMarchInput(d.march);
  if (!name || !seconds || seconds <= 0) return false;
  const alliance = (d.alliance || "").trim() || "Unassigned";
  roster.value = [...roster.value, { id: nextId(), name, team, alliance, marchTime: seconds }];
  draft.value = { ...draft.value, [team]: { name: "", march: "", alliance: "" } };
  persist();
  return true;
}

export function startEditPerson(id) {
  const p = roster.value.find((x) => x.id === id);
  if (!p) return;
  editDraft.value = { id, name: p.name, march: String(p.marchTime), alliance: p.alliance };
}
export function updateEditDraft(field, value) {
  if (!editDraft.value) return;
  editDraft.value = { ...editDraft.value, [field]: value };
}
export function cancelEditPerson() {
  editDraft.value = null;
}
export function saveEditPerson() {
  const d = editDraft.value;
  if (!d) return false;
  const name = d.name.trim();
  const seconds = parseMarchInput(d.march);
  if (!name || !seconds || seconds <= 0) return false;
  const alliance = (d.alliance || "").trim() || "Unassigned";
  roster.value = roster.value.map((p) =>
    p.id === d.id ? { ...p, name, marchTime: seconds, alliance } : p
  );
  editDraft.value = null;
  persist();
  return true;
}

// ---- delete confirmation -------------------------------------------------

export function requestDelete(type, id) {
  if (type === "person") {
    const p = roster.value.find((x) => x.id === id);
    if (!p) return;
    pendingDelete.value = { type, id, label: `${p.name} from the roster` };
  } else if (type === "rally") {
    const r = rallies.value.find((x) => x.id === id);
    if (!r) return;
    pendingDelete.value = { type, id, label: `the rally for ${r.name}` };
  } else if (type === "group") {
    const g = groups.value.find((x) => x.id === id);
    if (!g) return;
    pendingDelete.value = { type, id, label: `the sync group "${g.name}"` };
  } else if (type === "groupLaunch") {
    const g = groups.value.find((x) => x.id === id);
    const count = rallies.value.filter((r) => r.groupId === id).length;
    if (!count) return;
    pendingDelete.value = {
      type,
      id,
      label: `${count} launched ${count === 1 ? "rally" : "rallies"} from "${g ? g.name : "this group"}"`,
    };
  }
}
export function cancelDelete() {
  pendingDelete.value = null;
}
export function confirmDelete() {
  const pd = pendingDelete.value;
  if (!pd) return;
  if (pd.type === "person") {
    roster.value = roster.value.filter((p) => p.id !== pd.id);
  } else if (pd.type === "rally") {
    rallies.value = rallies.value.filter((r) => r.id !== pd.id);
    const { [pd.id]: _drop, ...rest } = expanded.value;
    expanded.value = rest;
  } else if (pd.type === "group") {
    groups.value = groups.value.filter((g) => g.id !== pd.id);
  } else if (pd.type === "groupLaunch") {
    rallies.value = rallies.value.filter((r) => r.groupId !== pd.id);
  }
  pendingDelete.value = null;
  persist();
}

// ---- rally actions ---------------------------------------------------

export function startRally(personId) {
  const person = roster.value.find((p) => p.id === personId);
  if (!person) return;
  const rally = { id: nextId(), ...buildRally(person, {}, Date.now()) };
  rallies.value = [...rallies.value, rally];
  persist();
}

export function startScheduledNow(id) {
  const t = Date.now();
  rallies.value = rallies.value.map((r) => {
    if (r.id !== id) return r;
    return { ...r, startAt: t, hitTime: t + (RALLY_BUFFER + r.marchTime) * 1000 };
  });
  persist();
}

export function adjustRally(id, delta) {
  const t = Date.now();
  rallies.value = rallies.value.map((r) => {
    if (r.id !== id) return r;
    const next = { ...r, hitTime: r.hitTime + delta * 1000 };
    if (r.startAt && t < r.startAt) next.startAt = r.startAt + delta * 1000;
    return next;
  });
  persist();
}

export function toggleExpanded(id) {
  const cur = expanded.value[id];
  expanded.value = { ...expanded.value, [id]: cur === false ? true : false };
}
export function toggleGroupExpanded(id) {
  const cur = groupExpanded.value[id];
  groupExpanded.value = { ...groupExpanded.value, [id]: cur === false ? true : false };
}

// ---- sync group actions -----------------------------------------------

export function openGroupEditor(id) {
  if (id == null) {
    groupEditor.value = { id: null, name: "", memberIds: [] };
  } else {
    const g = groups.value.find((x) => x.id === id);
    if (!g) return;
    groupEditor.value = { id: g.id, name: g.name, memberIds: [...g.memberIds] };
  }
}
export function cancelGroupEditor() {
  groupEditor.value = null;
}
export function updateGroupEditorName(name) {
  if (!groupEditor.value) return;
  groupEditor.value = { ...groupEditor.value, name };
}
export function toggleGroupMember(personId) {
  const ge = groupEditor.value;
  if (!ge) return;
  const has = ge.memberIds.includes(personId);
  const memberIds = has ? ge.memberIds.filter((x) => x !== personId) : [...ge.memberIds, personId];
  groupEditor.value = { ...ge, memberIds };
}
export function saveGroup() {
  const ge = groupEditor.value;
  if (!ge) return false;
  const name = ge.name.trim() || `Sync Group ${groups.value.length + 1}`;
  if (ge.memberIds.length < 2) return false;
  if (ge.id == null) {
    groups.value = [
      ...groups.value,
      { id: nextId(), name, memberIds: [...ge.memberIds], mode: "now", targetTime: "", launchDelay: 0 },
    ];
  } else {
    groups.value = groups.value.map((g) =>
      g.id === ge.id ? { ...g, name, memberIds: [...ge.memberIds] } : g
    );
  }
  groupEditor.value = null;
  persist();
  return true;
}
export function setGroupMode(id, mode) {
  groups.value = groups.value.map((g) => (g.id === id ? { ...g, mode } : g));
  persist();
}
export function setGroupTargetTime(id, targetTime) {
  groups.value = groups.value.map((g) => (g.id === id ? { ...g, targetTime } : g));
  persist();
}
export function setGroupPreset(id, presetKey) {
  const g = groups.value.find((x) => x.id === id);
  if (!g) return;
  const t = Date.now();
  if (g.mode === "now") {
    const delays = { now: 0, "10s": 10, "30s": 30, "1m": 60, "5m": 300 };
    if (!(presetKey in delays)) return;
    groups.value = groups.value.map((x) => (x.id === id ? { ...x, launchDelay: delays[presetKey] } : x));
    persist();
    return;
  }
  const offsets = { "6m": 6 * 60 * 1000, "10m": 10 * 60 * 1000 };
  if (!(presetKey in offsets)) return;
  const target = t + offsets[presetKey];
  groups.value = groups.value.map((x) =>
    x.id === id ? { ...x, mode: "target", targetTime: fmtClockUTC(new Date(target)) } : x
  );
  persist();
}
export function launchGroup(groupId) {
  const g = groups.value.find((x) => x.id === groupId);
  if (!g) return false;
  const members = roster.value.filter((p) => g.memberIds.includes(p.id));
  if (members.length < 2) return false;
  const plan = planGroupLaunch(members, g, Date.now());
  if (!plan) return false;
  const newRallies = plan.map(({ person, startAt, hitTime }) => ({
    id: nextId(),
    ...buildRally(person, { startAt, hitTime, groupId: g.id }),
  }));
  rallies.value = [...rallies.value, ...newRallies];
  persist();
  return true;
}

// ---- backup / restore ----------------------------------------------------

export async function exportBackup() {
  return storage.exportBackup({ roster: roster.value, rallies: rallies.value, groups: groups.value });
}
export async function importBackup(text) {
  const data = storage.parseBackup(text);
  idCounter =
    1 +
    Math.max(
      0,
      ...data.roster.map((p) => p.id),
      ...data.rallies.map((r) => r.id),
      ...data.groups.map((g) => g.id)
    );
  batch(() => {
    roster.value = data.roster;
    rallies.value = data.rallies;
    groups.value = data.groups;
  });
  persist();
}
