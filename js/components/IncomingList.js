import { html } from "../preact-setup.js";
import { sortedRallies } from "../store.js";
import { RallyCard } from "./RallyCard.js";

export function IncomingList() {
  const list = sortedRallies.value;
  return html`
    <div class="section">
      <div class="section-title">Incoming (${list.length})</div>
      ${list.length === 0 ? html`<div class="empty-state">No active rallies.</div>` : null}
      <div class="list-col">
        ${list.map((r) => html`<${RallyCard} key=${r.id} r=${r} />`)}
      </div>
    </div>
  `;
}
