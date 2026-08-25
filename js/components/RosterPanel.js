import { html } from "../preact-setup.js";
import { TEAM_META } from "../model.js";
import {
  roster,
  draft,
  editDraft,
  updateDraft,
  addPerson,
  startEditPerson,
  updateEditDraft,
  cancelEditPerson,
  saveEditPerson,
  requestDelete,
  startRally,
} from "../store.js";

function AddRow(team) {
  const d = draft.value[team];
  const onKey = (e) => {
    if (e.key === "Enter") addPerson(team);
  };
  return html`
    <div class="member-add-row">
      <input
        class="field"
        placeholder="Name"
        value=${d.name}
        onInput=${(e) => updateDraft(team, "name", e.target.value)}
        onKeyDown=${onKey}
      />
      <input
        class="field"
        placeholder="Alliance"
        value=${d.alliance}
        onInput=${(e) => updateDraft(team, "alliance", e.target.value)}
        onKeyDown=${onKey}
      />
      <input
        class="field"
        placeholder="March m:ss"
        value=${d.march}
        onInput=${(e) => updateDraft(team, "march", e.target.value)}
        onKeyDown=${onKey}
      />
      <button
        class="btn"
        style="background:${TEAM_META[team].accent};color:#0B0F0E;border:none;border-radius:6px;padding:8px 12px;font-weight:700;"
        onClick=${() => addPerson(team)}
      >+</button>
    </div>
  `;
}

function PersonRow(p) {
  const meta = TEAM_META[p.team];
  const ed = editDraft.value;
  if (ed && ed.id === p.id) {
    const onKey = (e) => {
      if (e.key === "Enter") saveEditPerson();
      if (e.key === "Escape") cancelEditPerson();
    };
    return html`
      <div class="member-add-row" key=${p.id}>
        <input class="field dark" value=${ed.name} onInput=${(e) => updateEditDraft("name", e.target.value)} onKeyDown=${onKey} />
        <input class="field dark" value=${ed.alliance} onInput=${(e) => updateEditDraft("alliance", e.target.value)} onKeyDown=${onKey} />
        <input class="field dark" value=${ed.march} onInput=${(e) => updateEditDraft("march", e.target.value)} onKeyDown=${onKey} />
        <div class="row" style="gap:4px;">
          <button class="btn" style="background:#3FD6C7;border:none;border-radius:4px;padding:6px 8px;" onClick=${() => saveEditPerson()}>✓</button>
          <button class="btn" style="background:#1D2523;border:none;border-radius:4px;padding:6px 8px;color:#8A948F;" onClick=${cancelEditPerson}>✕</button>
        </div>
      </div>
    `;
  }
  return html`
    <div class="row" style="justify-content:space-between;padding:6px 2px;gap:8px;" key=${p.id}>
      <div class="row" style="gap:6px;min-width:0;">
        <span class="dot" style="background:${meta.accent};"></span>
        <span style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</span>
        <span class="mono" style="font-size:10.5px;color:#5A6560;white-space:nowrap;">${p.alliance} · ${p.marchTime}s</span>
      </div>
      <div class="row" style="gap:4px;flex-shrink:0;">
        <button class="btn" title="Start rally" style="background:${meta.accent};color:#0B0F0E;border:none;border-radius:6px;padding:5px 9px;font-size:12px;font-weight:600;" onClick=${() => startRally(p.id)}>▶</button>
        <button class="btn" title="Edit" style="background:#1D2523;border:none;border-radius:6px;padding:5px 8px;color:#8A948F;" onClick=${() => startEditPerson(p.id)}>✎</button>
        <button class="icon-btn" title="Delete" onClick=${() => requestDelete("person", p.id)}>✕</button>
      </div>
    </div>
  `;
}

function TeamColumn(team) {
  const meta = TEAM_META[team];
  const people = roster.value.filter((p) => p.team === team);
  return html`
    <div class="card">
      <div class="row" style="justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:12px;font-weight:700;color:${meta.accent};">${meta.icon} ${meta.label}</span>
        <span class="mono" style="font-size:10.5px;color:#5A6560;">${people.length}</span>
      </div>
      ${AddRow(team)}
      <div style="margin-top:8px;display:flex;flex-direction:column;">
        ${people.length === 0
          ? html`<div class="empty-state" style="margin-top:8px;">No one added yet.</div>`
          : people.map(PersonRow)}
      </div>
    </div>
  `;
}

export function RosterPanel() {
  return html`
    <div class="section">
      <div class="section-title">Roster</div>
      <div class="roster-teams" style="gap:10px;">
        ${TeamColumn("ally")}
        ${TeamColumn("enemy")}
      </div>
    </div>
  `;
}
