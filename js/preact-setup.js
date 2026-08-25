import { h, render as preactRender, Fragment } from "https://esm.sh/preact@10";
import htm from "https://esm.sh/htm@3";

export const html = htm.bind(h);
export { preactRender, Fragment };
