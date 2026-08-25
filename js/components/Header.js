import { html } from "../preact-setup.js";
import { exportBackup, importBackup, backupNotice } from "../store.js";

function download(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleExport() {
  const json = await exportBackup();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  download(`rally-tracker-backup-${stamp}.json`, json);
  backupNotice.value = { kind: "ok", text: "Backup downloaded." };
  setTimeout(() => (backupNotice.value = null), 2500);
}

function handleImportClick() {
  document.getElementById("import-file-input").click();
}

async function handleImportFile(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const text = await file.text();
    await importBackup(text);
    backupNotice.value = { kind: "ok", text: "Backup restored." };
  } catch (err) {
    backupNotice.value = { kind: "error", text: "Couldn't read that file: " + err.message };
  }
  setTimeout(() => (backupNotice.value = null), 3000);
}

export function Header() {
  return html`
    <div class="row header-bar" style="justify-content:space-between;">
      <div class="row" style="gap:10px;">
        <span style="font-size:20px;">📡</span>
        <div>
          <div class="display" style="font-size:22px;color:#F2A93B;line-height:1;">RALLY TRACKER</div>
          <div class="mono" style="font-size:11px;color:#6B7570;margin-top:2px;">Castle battle</div>
        </div>
      </div>
      <div class="row" style="gap:6px;">
        <button class="pill" onClick=${handleExport} title="Download a JSON backup of your roster, rallies, and groups">⭳ Export</button>
        <button class="pill" onClick=${handleImportClick} title="Restore from a previously exported backup">⭱ Import</button>
        <input id="import-file-input" type="file" accept="application/json" style="display:none;" onChange=${handleImportFile} />
      </div>
    </div>
    ${backupNotice.value
      ? html`<div class="toast ${backupNotice.value.kind}">${backupNotice.value.text}</div>`
      : null}
  `;
}
