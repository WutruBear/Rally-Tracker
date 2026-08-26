import { html, useState, useEffect } from "./preact-setup.js";
import { subscribe } from "./reactive.js";
import { Header } from "./components/Header.js";
import { RosterPanel } from "./components/RosterPanel.js";
import { IncomingList } from "./components/IncomingList.js";
import { GroupsPanel } from "./components/GroupsPanel.js";
import { DeleteModal } from "./components/DeleteModal.js";

export function App() {
  // The one subscription that matters: whenever any store signal changes,
  // this forces App (and everything under it) to re-render. Preact's own
  // diffing keeps the actual DOM writes cheap, so a full top-down re-render
  // on every tick/action is simple and reliable rather than fine-grained.
  const [, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);

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
