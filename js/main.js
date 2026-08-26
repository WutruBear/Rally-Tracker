import { preactRender, html } from "./preact-setup.js";
import { App } from "./AppRoot.js";
import { init } from "./store.js";

init().then(() => {
  preactRender(html`<${App} />`, document.getElementById("root"));
});
