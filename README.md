# Rally Tracker

A rally hit-timer tracker for alliance/castle battles: track your roster's march
times, start rallies, and launch synced groups that all land at the same
moment.

This is a from-scratch rebuild of the original single-file version. Same
feature set, different foundations — see "What changed" below.

## Running it locally

No build step. Any static file server works, e.g.:

```
npx http-server -c-1 .
# or
python3 -m http.server 8080
```

Then open the printed URL. Preact, htm, and idb-keyval are bundled locally
in `js/vendor/` — no CDN calls at runtime, so it works offline too.

## Running the tests

The domain logic (parsing, timer state, sort order, group-launch math) lives
in `js/model.js` with zero DOM or framework dependencies, so it runs under
plain Node:

```
npm test
```

## Hosting on GitHub Pages

1. Push this folder to a GitHub repository (root of the repo, or a `/docs`
   folder — either works). Make sure the empty `.nojekyll` file at the top
   of this folder is included — GitHub Pages runs a Jekyll build by default,
   and without `.nojekyll` it will try to process this as a Jekyll site and
   fail (it chokes on `README.md` via the `jekyll-readme-index` plugin).
   `.nojekyll` tells Pages to skip that and serve the files as-is.
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", choose **Deploy from a branch**, pick your
   branch, and the folder you pushed it to (`/` or `/docs`).
4. Save. GitHub gives you a URL like
   `https://<username>.github.io/<repo>/` within a minute or two.

No GitHub Actions workflow is needed since there's no build step — it's
served as-is.

## Project structure

```
index.html               entry point, loads css + js/app.js as a module
css/styles.css            all styling
js/model.js               pure domain logic (parsing, timers, sorting) — unit tested
js/storage.js             IndexedDB persistence w/ localStorage fallback, versioned schema
js/reactive.js            tiny dependency-free store primitive (signal/computed/batch + subscribe)
js/store.js               app state (built on reactive.js) + actions
js/preact-setup.js        re-exports from the local vendor bundle (see below)
js/vendor/preact-bundle.js      Preact + hooks + htm, bundled locally with esbuild
js/vendor/idb-keyval-bundle.js  idb-keyval, bundled locally with esbuild
js/App.js, js/app.js      root component + mount
js/components/*.js        Header, RosterPanel, IncomingList, RallyCard, GroupsPanel, DeleteModal
tests/model.test.js       unit tests (node --test)
```

## What changed from the original single-file version

- **Rendering**: the old version rebuilt one big HTML string and diffed the
  DOM by hand (`captureFocus`/`restoreFocus` to avoid losing cursor position,
  a separate `tickTimers()` path duplicating the render logic just to avoid
  a full re-render every second). This version uses Preact: state lives in
  a small dependency-free store (`js/reactive.js`), and the app root
  re-renders the whole tree on any change — Preact's own diffing keeps the
  actual DOM writes cheap, so there's no manual focus juggling and no second
  render path to keep in sync with the first.
- **State machine**: rally status (`scheduled` / `marching` / `hit`) is a
  pure function of timestamps (`rallyPhase()` in `model.js`) instead of an
  ad hoc `_wasScheduled` flag mutated during render.
- **Sync groups**: still store `memberIds`, but the launch math
  (`planGroupLaunch`) is a pure function you can unit test without touching
  the DOM or the id counter.
- **Persistence**: IndexedDB first (bigger quota, more robust across
  browsers) with a transparent localStorage fallback, and an explicit
  `schemaVersion` + migration list instead of inline patches like
  `r.startAt != null ? r.startAt : r.startTime` scattered through state
  bootstrap.
- **Tests**: `js/model.js` has zero DOM/framework dependencies specifically
  so the timer/sort/parsing logic — including the group hit-time-tie sort
  order bug fixed earlier — can be covered by real unit tests instead of
  manual clicking.
- **New, small**: Export/Import JSON backup (top-right of the header), since
  it fell out naturally once storage had a clean save/load boundary.

## Note on an earlier version

An earlier draft of this rebuild loaded Preact and `@preact/signals` from
two separate CDN URLs at runtime. That's what caused the black screen you
hit: `@preact/signals`'s auto-re-render mechanism only works if it patches
the *exact same* Preact module instance the app renders with, which two
independently-resolved CDN requests don't reliably guarantee — and my
sandbox's network is locked to a small domain allowlist that doesn't
include that CDN, so I wasn't able to catch it by testing before handing
it to you. This version removes that entire risk: Preact, its hooks, htm,
and idb-keyval are all bundled into two local files under `js/vendor/`
(built with esbuild from the real npm packages), so there's exactly one
copy of each loaded, and it works without any CDN at all. I also verified
this version end-to-end with jsdom (mount, add a person, start a rally,
confirm it renders) before sending it to you — still worth a quick sanity
check on your end after deploying, but this should be solid.
