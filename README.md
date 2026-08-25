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

Then open the printed URL. The app loads Preact, Preact Signals, htm, and
idb-keyval from esm.sh at runtime — an internet connection is required the
first time each is fetched (the browser caches them after that).

## Running the tests

The domain logic (parsing, timer state, sort order, group-launch math) lives
in `js/model.js` with zero DOM or framework dependencies, so it runs under
plain Node:

```
npm test
```

## Hosting on GitHub Pages

1. Push this folder to a GitHub repository (root of the repo, or a `/docs`
   folder — either works).
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", choose **Deploy from a branch**, pick your
   branch, and the folder you pushed it to (`/` or `/docs`).
4. Save. GitHub gives you a URL like
   `https://<username>.github.io/<repo>/` within a minute or two.

No GitHub Actions workflow is needed since there's no build step — it's
served as-is.

## Project structure

```
index.html              entry point, loads css + js/app.js as a module
css/styles.css           all styling
js/model.js              pure domain logic (parsing, timers, sorting) — unit tested
js/storage.js            IndexedDB persistence w/ localStorage fallback, versioned schema
js/store.js              reactive app state (Preact Signals) + actions
js/preact-setup.js       single place pinning the Preact/htm CDN versions
js/App.js, js/app.js     root component + mount
js/components/*.js       Header, RosterPanel, IncomingList, RallyCard, GroupsPanel, DeleteModal
tests/model.test.js      unit tests (node --test)
```

## What changed from the original single-file version

- **Rendering**: the old version rebuilt one big HTML string and diffed the
  DOM by hand (`captureFocus`/`restoreFocus` to avoid losing cursor position,
  a separate `tickTimers()` path duplicating the render logic just to avoid
  a full re-render every second). This version uses Preact + Signals: each
  component subscribes only to the state it reads, so a running countdown
  updates just its own text node — no manual focus juggling, no second
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

## Known limitation of this rebuild

Because this environment's network access is locked to a small domain
allowlist, I could syntax-check every module and unit-test all the pure
logic here, but I could **not** load the app end-to-end in a real browser
against the esm.sh CDN from this sandbox. Please do a quick smoke test after
your first deploy (add a person, start a rally, launch a 2+ person sync
group) — if anything's off, tell me what you saw and I'll fix it fast.
