// ---------------------------------------------------------------------------
// A tiny reactive store, deliberately dependency-free.
//
// Why not @preact/signals? Loading Preact and @preact/signals as two
// separate CDN module requests can resolve to two different bundled copies
// of Preact under the hood (each package brings its own internal reference).
// When that happens, signals' automatic "re-render on change" hook attaches
// to a Preact instance that isn't the one actually rendering your tree, and
// nothing updates — silently. Keeping this store's only dependency being the
// app's own root re-render (see App.js) sidesteps that failure mode
// entirely: it only needs to notify subscribers, and App owns the one
// subscription that matters.
// ---------------------------------------------------------------------------

const bus = new Set();
let batching = false;
let pendingNotify = false;

function notify() {
  if (batching) {
    pendingNotify = true;
    return;
  }
  bus.forEach((cb) => cb());
}

export function signal(initial) {
  let val = initial;
  return {
    get value() {
      return val;
    },
    set value(v) {
      val = v;
      notify();
    },
  };
}

// Recomputed on every access rather than cached — fine for the cheap array
// filters/sorts this app uses computed() for.
export function computed(fn) {
  return {
    get value() {
      return fn();
    },
  };
}

export function batch(fn) {
  const alreadyBatching = batching;
  batching = true;
  try {
    fn();
  } finally {
    if (!alreadyBatching) {
      batching = false;
      if (pendingNotify) {
        pendingNotify = false;
        notify();
      }
    }
  }
}

// Called once, at the app root, to trigger a full re-render whenever any
// signal in the store changes.
export function subscribe(cb) {
  bus.add(cb);
  return () => bus.delete(cb);
}
