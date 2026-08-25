import { html } from "../preact-setup.js";
import { TEAM_META, RALLY_BUFFER, fmtClockUTC, fmtMMSS, getCountdownState } from "../model.js";
import {
  roster,
  groups,
  rallies,
  now,
  groupExpanded,
  groupEditor,
  toggleGroupExpanded,
  openGroupEditor,
  cancelGroupEditor,
  updateGroupEditorName,
  toggleGroupMember,
  saveGroup,
  setGroupMode,
  setGroupTargetTime,
  setGroupPreset,
  launchGroup,
  requestDelete,
} from "../store.js";

function GroupEditorPanel() {
  const ge = groupEditor.value;
  if (!ge) return null;
  const ally = roster.value.filter((p) => p.team === "ally");
  return html`
    <div class="card" style="margin-bottom:10px;">
      <input
        class="field"
        style="width:100%;margin-bottom:8px;"
        placeholder="Group name"
        value=${ge.name}
        onInput=${(e) => updateGroupEditorName(e.target.value)}
      />
      <div class="small-label" style="margin-bottom:6px;">SELECT AT LEAST 2 MEMBERS (ALLY ROSTER)</div>
      <div style="display:flex;flex-direction:column;gap:4px;max-height:220px;overflow:auto;">
        ${ally.length === 0
          ? html`<div class="empty-state">Add allies to your roster first.</div>`
          : ally.map(
              (p) => html`
                <label class="row" style="gap:8px;font-size:13px;padding:3px 0;" key=${p.id}>
                  <input
                    type="checkbox"
                    class="member-option"
                    checked=${ge.memberIds.includes(p.id)}
                    onChange=${() => toggleGroupMember(p.id)}
                  />
                  <span>${p.name}</span>
                  <span class="mono" style="font-size:10.5px;color:#5A6560;">${p.marchTime}s</span>
                </label>
              `
            )}
      </div>
      <div class="row" style="gap:8px;margin-top:10px;justify-content:flex-end;">
        <button class="pill" onClick=${cancelGroupEditor}>Cancel</button>
        <button class="pill active" onClick=${saveGroup}>Save group</button>
      </div>
    </div>
  `;
}

function GroupCard(g) {
  const t = now.value;
  const isExpanded = groupExpanded.value[g.id] !== false;
  const members = roster.value.filter((p) => g.memberIds.includes(p.id));
  const totals = members.map((p) => RALLY_BUFFER + p.marchTime);
  const maxTotal = totals.length ? Math.max(...totals) : 0;
  const launchedCount = rallies.value.filter((r) => r.groupId === g.id).length;

  const presetsNow = [["now", "Now"], ["10s", "+10s"], ["30s", "+30s"], ["1m", "+1m"], ["5m", "+5m"]];
  const presetsTarget = [["6m", "+6m"], ["10m", "+10m"]];

  return html`
    <div class="card" key=${g.id}>
      <div class="row" style="justify-content:space-between;gap:8px;">
        <button class="group-toggle" onClick=${() => toggleGroupExpanded(g.id)}>
          <span style="font-size:13px;font-weight:600;">🎯 ${g.name}</span>
          <span class="mono" style="font-size:10.5px;color:#5A6560;margin-left:8px;">${members.length} members</span>
        </button>
        <div class="row" style="gap:4px;">
          <button class="btn" style="background:#1D2523;border:none;border-radius:6px;padding:5px 8px;color:#8A948F;" onClick=${() => openGroupEditor(g.id)}>✎</button>
          <button class="icon-btn" onClick=${() => requestDelete("group", g.id)}>✕</button>
        </div>
      </div>

      ${isExpanded
        ? html`
            <div style="margin-top:10px;border-top:1px solid #1D2523;padding-top:10px;">
              <div class="row" style="gap:6px;margin-bottom:8px;">
                <button class="pill ${g.mode === "now" ? "active" : ""}" onClick=${() => setGroupMode(g.id, "now")}>Launch delay</button>
                <button class="pill ${g.mode === "target" ? "active" : ""}" onClick=${() => setGroupMode(g.id, "target")}>Target UTC time</button>
              </div>

              ${g.mode === "now"
                ? html`
                    <div class="row" style="gap:6px;flex-wrap:wrap;">
                      ${presetsNow.map(
                        ([key, label]) => html`
                          <button
                            class="pill ${Number(g.launchDelay) === (key === "now" ? 0 : key === "10s" ? 10 : key === "30s" ? 30 : key === "1m" ? 60 : 300) ? "active" : ""}"
                            key=${key}
                            onClick=${() => setGroupPreset(g.id, key)}
                          >${label}</button>
                        `
                      )}
                    </div>
                    <div class="mono js-group-eta" style="font-size:11.5px;color:#8A948F;margin-top:8px;">
                      🎯 ≈ hits UTC ${fmtClockUTC(new Date(t + ((Number(g.launchDelay) || 0) + maxTotal) * 1000))} if launched now
                    </div>
                  `
                : html`
                    <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center;">
                      <input
                        class="field dark"
                        style="width:110px;"
                        placeholder="HH:MM:SS"
                        value=${g.targetTime}
                        onInput=${(e) => setGroupTargetTime(g.id, e.target.value)}
                        onKeyDown=${(e) => e.key === "Enter" && e.target.blur()}
                      />
                      ${presetsTarget.map(
                        ([key, label]) => html`<button class="pill" key=${key} onClick=${() => setGroupPreset(g.id, key)}>${label}</button>`
                      )}
                    </div>
                  `}

              <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px;">
                ${members.map((p) => {
                  const startBy =
                    g.mode === "target"
                      ? null
                      : t + ((Number(g.launchDelay) || 0) + maxTotal - (RALLY_BUFFER + p.marchTime)) * 1000;
                  const cd = startBy != null ? getCountdownState(startBy, t) : null;
                  return html`
                    <div class="row" style="gap:6px;font-size:12.5px;justify-content:space-between;" key=${p.id}>
                      <div class="row" style="gap:6px;">
                        <span class="dot" style="background:${TEAM_META[p.team].accent};"></span>
                        <span>${p.name}</span>
                        <span class="mono" style="color:#5A6560;font-size:10.5px;">${p.marchTime}s march</span>
                      </div>
                      ${cd
                        ? html`<span class="mono" style="font-size:11.5px;font-weight:700;color:${cd.late ? "#E1594F" : cd.startNow ? "#F2A93B" : "#8A948F"};">
                            starts ${cd.startNow ? "now" : fmtMMSS(cd.secs)}
                          </span>`
                        : null}
                    </div>
                  `;
                })}
              </div>

              <div class="row" style="justify-content:space-between;margin-top:10px;">
                <button
                  class="btn"
                  style="background:#3FD6C7;color:#0B0F0E;border:none;border-radius:6px;padding:7px 12px;font-size:12.5px;font-weight:700;"
                  onClick=${() => launchGroup(g.id)}
                  disabled=${members.length < 2}
                >🚀 Launch group</button>
                ${launchedCount > 0
                  ? html`<button class="pill" onClick=${() => requestDelete("groupLaunch", g.id)}>Clear ${launchedCount} launched</button>`
                  : null}
              </div>
            </div>
          `
        : null}
    </div>
  `;
}

export function GroupsPanel() {
  return html`
    <div class="section">
      <div class="row" style="justify-content:space-between;margin-bottom:10px;">
        <div class="section-title" style="margin:0;">Sync Groups</div>
        <button class="pill active" onClick=${() => openGroupEditor(null)}>+ New group</button>
      </div>
      ${GroupEditorPanel()}
      ${groups.value.length === 0
        ? html`<div class="empty-state">No sync groups yet. Create one to launch several rallies at the same hit time.</div>`
        : html`<div class="list-col">${groups.value.map(GroupCard)}</div>`}
    </div>
  `;
}
