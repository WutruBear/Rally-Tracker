import { html } from "../preact-setup.js";
import { pendingDelete, cancelDelete, confirmDelete } from "../store.js";

export function DeleteModal() {
  const pd = pendingDelete.value;
  if (!pd) return null;
  return html`
    <div class="modal-overlay" onClick=${cancelDelete}>
      <div class="modal-card" onClick=${(e) => e.stopPropagation()}>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px;">Remove ${pd.label}?</div>
        <div style="font-size:12.5px;color:#8A948F;margin-bottom:16px;">This can't be undone.</div>
        <div class="row" style="gap:8px;justify-content:flex-end;">
          <button class="pill" onClick=${cancelDelete}>Cancel</button>
          <button class="pill" style="background:#E1594F;color:#0B0F0E;border-color:#E1594F;" onClick=${confirmDelete}>Remove</button>
        </div>
      </div>
    </div>
  `;
}
