import { html } from "./preact-setup.js";
import { Header } from "./components/Header.js";
import { RosterPanel } from "./components/RosterPanel.js";
import { IncomingList } from "./components/IncomingList.js";
import { GroupsPanel } from "./components/GroupsPanel.js";
import { DeleteModal } from "./components/DeleteModal.js";

export function App() {
  return html`
    <div>
      <${Header} />
      <${IncomingList} />
      <${GroupsPanel} />
      <${RosterPanel} />
      <${DeleteModal} />
    </div>
  `;
}
