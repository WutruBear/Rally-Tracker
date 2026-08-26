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

## Hosting on GitHub Pages — the git way

This walks through pushing with the actual `git` command line instead of the
web upload UI. The web uploader is what caused the last two failed deploys
(it silently drops nested folders like `js/vendor/`, and it can't warn you
about the filesystem case-collision that ate `js/main.js`) — `git` doesn't
have either problem, because it hashes and tracks every file's exact bytes,
not just what a file browser shows you.

**0. Get the files onto your machine as a real folder**, not just wherever
your zip tool extracted them. Unzip this project somewhere you can find it
in a terminal, e.g. `~/projects/rally-tracker`.

**1. Install git**, if you don't already have it: [git-scm.com/downloads](https://git-scm.com/downloads).
Confirm it worked:
```
git --version
```

**2. Open a terminal in the project folder.**
```
cd ~/projects/rally-tracker
```
(On Windows, Git Bash — installed alongside git — is the easiest terminal
for these commands.)

**3. Turn the folder into a git repository and commit everything.**
```
git init
git add .
git status
```
Look at the output of `git status` before committing — it lists every file
git is about to track. This is your chance to actually verify `js/vendor/`,
`js/main.js`, and `js/AppRoot.js` are all in there, instead of finding out
after pushing like last time.
```
git commit -m "Initial commit"
```

**4. Create an empty repository on GitHub** (github.com → the "+" in the top
right → New repository). Give it a name, and **don't** check "Add a
README" or any other initialize option — you want it completely empty so
your first push isn't fighting an unrelated history.

**5. Connect your local repo to it and push.** GitHub shows you the exact
commands right after creating the repo, but they look like this:
```
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

**6. Verify what actually landed**, before touching Pages settings at all.
Go to `github.com/<your-username>/<repo-name>` in a browser and click into
`js/vendor/` — confirm `preact-bundle.js` and `idb-keyval-bundle.js` are
really there. This one check would have caught both previous failures
immediately.

**7. Turn on Pages.** Settings → Pages → under "Build and deployment", set
Source to **GitHub Actions**. This repo already includes
`.github/workflows/deploy.yml`, which deploys automatically on every push
to `main` — no manual "which branch, which folder" dropdown to get wrong.
The Actions tab shows you the deploy running; when it's green, your site is
live at `https://<your-username>.github.io/<repo-name>/`.

**From now on**, any time you change a file: `git add .`, `git commit -m
"..."`, `git push` — and the site redeploys itself in about a minute.

## Project structure

```
index.html                      entry point, loads css + js/main.js as a module
.github/workflows/deploy.yml    auto-deploys to Pages on every push to main
css/styles.css                  all styling
js/model.js                     pure domain logic (parsing, timers, sorting) — unit tested
js/storage.js                   IndexedDB persistence w/ localStorage fallback, versioned schema
js/reactive.js                  tiny dependency-free store primitive (signal/computed/batch + subscribe)
js/store.js                     app state (built on reactive.js) + actions
js/preact-setup.js              re-exports from the local vendor bundle (see below)
js/vendor/preact-bundle.js      Preact + hooks + htm, bundled locally with esbuild
js/vendor/idb-keyval-bundle.js  idb-keyval, bundled locally with esbuild
js/AppRoot.js, js/main.js       root component + mount (named to avoid any app.js/App.js
                                 case collision on case-insensitive filesystems)
js/components/*.js              Header, RosterPanel, IncomingList, RallyCard, GroupsPanel, DeleteModal
tests/model.test.js             unit tests (node --test)
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

## Note on earlier deploy attempts

Two things broke the first two attempts to deploy this, both about *upload
mechanics*, not the app code:

1. An early version loaded Preact from a CDN at runtime; two separately
   resolved CDN URLs didn't reliably share one Preact instance, so nothing
   ever re-rendered. Fixed by vendoring Preact/htm/idb-keyval locally with
   esbuild (`js/vendor/`) — no CDN calls at runtime at all.
2. The project originally had both `js/app.js` (entry point) and
   `js/App.js` (root component) — genuinely different files, differing only
   in case. On a case-insensitive filesystem (default on Mac/Windows) or
   through some upload paths, those collide into one file, silently
   dropping whichever didn't survive. Renamed to `js/main.js` and
   `js/AppRoot.js` so no two files in this project ever differ only in
   case, and separately, `js/vendor/` — a nested folder — didn't make it
   through a web-based drag-and-drop upload at all. The git workflow above
   avoids both: git tracks exact file identity regardless of case, and `git
   status` before committing shows you exactly what's about to be pushed.

I verified this version end-to-end with a headless browser (jsdom): mount,
add two roster members, start a rally, confirm it renders — before handing
it to you. Still worth a real-browser check after your first deploy, but
this should be solid.
