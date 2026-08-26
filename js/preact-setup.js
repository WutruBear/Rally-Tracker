// Preact, its hooks, and htm are bundled locally in js/vendor/preact-bundle.js
// (built with esbuild from the real npm packages). Loading everything from
// one local file guarantees the app's h/render and hooks all share the exact
// same Preact module instance -- no risk of two different CDN copies of
// Preact being loaded side by side and silently failing to talk to each
// other, which is what caused the earlier black-screen bug.
export { h, render as preactRender, Fragment, html, useState, useEffect, useRef } from "./vendor/preact-bundle.js";
