import { html, Fragment as Fragment_ } from "../preact-setup.js";
import {
  TEAM_META,
  RALLY_BUFFER,
  fmtMMSS,
  fmtClockUTC,
  getRallyTimerState,
  getCountdownState,
} from "../model.js";
import { roster, rallies, expanded, groups, now, toggleExpanded, startScheduledNow, adjustRally, requestDelete } from "../store.js";

function groupNameById(id) {
  const g = groups.value.find((x) => x.id === id);
  return g ? g.name : "Sync Group";
}

export function RallyCard({ r }) {
  const t = now.value;
  const meta = TEAM_META[r.team];
  const timer = getRallyTimerState(r, t);
  const { isScheduled, rallyRemaining, hitRemaining, hasHit, rallyDone, imminent, secsUntilStart, imminentStart } = timer;
  const isExpanded = expanded.value[r.id] !== false;

  const activePersonIds = new Set(rallies.value.map((x) => x.personId));
  const others = roster.value
    .filter((p) => !activePersonIds.has(p.id) && p.team === "ally")
    .map((p) => {
      const startBy = r.hitTime - (RALLY_BUFFER + p.marchTime) * 1000;
      const followStartBy = r.hitTime - RALLY_BUFFER * 1000;
      return { ...p, startBy, secsUntilStart: (startBy - t) / 1000, followStartBy, secsUntilFollowStart: (followStartBy - t) / 1000 };
    })
    .sort((a, b) => a.startBy - b.startBy);
  const isEnemy = r.team === "enemy";

  return html`
    <div
      class="card ${imminent ? "imminent" : ""} ${imminentStart ? "imminent-start" : ""}"
      style="border-color:${hasHit ? "#E1594F" : "#1D2523"};border-left:3px solid ${meta.accent};"
    >
      <div class="row" style="justify-content:space-between;gap:10px;">
        <div style="min-width:0;">
          <div style="font-size:14px;font-weight:600;color:#E8ECE9;">
            ${r.name}
            <span style="font-size:11px;color:${meta.accent};margin-left:6px;">${meta.label}</span>
            <span style="font-size:10px;color:#8A948F;margin-left:5px;">· ${r.alliance || "Unassigned"}</span>
            ${r.groupId ? html`<span style="font-size:10px;color:#3FD6C7;margin-left:5px;">· 🎯 ${groupNameById(r.groupId)}</span>` : null}
          </div>
          <div class="mono" style="font-size:11px;color:#6B7570;margin-top:2px;">
            ${isScheduled ? html`starts: UTC ${fmtClockUTC(new Date(r.startAt))} · ` : null}hits: UTC ${fmtClockUTC(new Date(r.hitTime))}
          </div>
        </div>
        <div class="row" style="gap:10px;">
          ${isScheduled
            ? html`
                <div style="text-align:right;">
                  <div class="small-label">STARTS IN</div>
                  <div class="mono" style="font-size:20px;font-weight:700;color:#F2A93B;min-width:60px;">${fmtMMSS(secsUntilStart)}</div>
                </div>
                <button class="btn" onClick=${() => startScheduledNow(r.id)} style="background:${meta.accent};color:#0B0F0E;border:none;border-radius:6px;padding:6px 10px;font-size:12px;font-weight:600;white-space:nowrap;">▶ Start now</button>
              `
            : html`
                <div style="text-align:right;">
                  <div class="small-label">RALLY</div>
                  <div class="mono" style="font-size:15px;font-weight:700;color:${rallyDone ? "#3E4A46" : "#8A948F"};">${rallyDone ? "0:00" : fmtMMSS(rallyRemaining)}</div>
                </div>
                <div style="text-align:right;">
                  <div class="small-label">HIT</div>
                  <div class="mono" style="font-size:20px;font-weight:700;color:${hasHit ? "#E1594F" : "#F2A93B"};min-width:60px;">${hasHit ? "HIT" : fmtMMSS(hitRemaining)}</div>
                </div>
              `}
          <div style="display:flex;flex-direction:column;gap:3px;">
            <div class="row" style="gap:3px;">
              <button class="adjbtn" title="Push hit time 10s later" onClick=${() => adjustRally(r.id, 10)}>+10</button>
              <button class="adjbtn" title="Push hit time 1s later" onClick=${() => adjustRally(r.id, 1)}>+1</button>
            </div>
            <div class="row" style="gap:3px;">
              <button class="adjbtn" title="Pull hit time 1s earlier" onClick=${() => adjustRally(r.id, -1)}>-1</button>
              <button class="adjbtn" title="Pull hit time 10s earlier" onClick=${() => adjustRally(r.id, -10)}>-10</button>
            </div>
          </div>
          <button class="icon-btn" onClick=${() => requestDelete("rally", r.id)}>✕</button>
        </div>
      </div>

      ${others.length > 0
        ? html`
            <button type="button" class="sync-toggle" onClick=${() => toggleExpanded(r.id)} aria-expanded=${isExpanded}>
              <span aria-hidden="true">${isExpanded ? "▾" : "▸"}</span>
              <span aria-hidden="true">👥</span>
              ${isEnemy ? "Sync same-time or follow-up hit" : "Sync others to this hit"}
            </button>
            ${isExpanded
              ? html`
                  <div style="margin-top:8px;border-top:1px solid #1D2523;padding-top:8px;">
                    <div class="sync-grid" style="grid-template-columns:${isEnemy ? "1fr 84px 84px" : "1fr 84px"};">
                      ${isEnemy
                        ? html`
                            <span></span>
                            <span class="mono" style="font-size:9px;color:#5A6560;letter-spacing:0.04em;text-align:right;">SAME TIME</span>
                            <span class="mono" style="font-size:9px;color:#5A6560;letter-spacing:0.04em;text-align:right;">FOLLOW-UP</span>
                          `
                        : null}
                      ${others.map((p) => {
                        const pMeta = TEAM_META[p.team];
                        const startState = getCountdownState(p.startBy, t);
                        const followState = getCountdownState(p.followStartBy, t);
                        return html`
                          <${Fragment_} key=${p.id}>
                            <div class="row" style="gap:6px;min-width:0;font-size:12.5px;">
                              <span class="dot" style="background:${pMeta.accent};"></span>
                              <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</span>
                              <span class="mono" style="color:#5A6560;font-size:10.5px;white-space:nowrap;">(${p.marchTime}s)</span>
                            </div>
                            <div class="mono" style="font-size:12.5px;font-weight:700;text-align:right;color:${startState.late ? "#E1594F" : startState.startNow ? "#F2A93B" : "#8A948F"};">
                              ${startState.startNow ? "now" : fmtMMSS(p.secsUntilStart)}
                            </div>
                            ${isEnemy
                              ? html`<div class="mono" style="font-size:12.5px;font-weight:700;text-align:right;color:${followState.late ? "#E1594F" : followState.startNow ? "#3FD6C7" : "#8A948F"};">
                                  ${followState.startNow ? "now" : fmtMMSS(p.secsUntilFollowStart)}
                                </div>`
                              : null}
                          <//>
                        `;
                      })}
                    </div>
                  </div>
                `
              : null}
          `
        : null}
    </div>
  `;
}
