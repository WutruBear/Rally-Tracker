import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMarchInput,
  parseUTCTimeToday,
  fmtMMSS,
  sortRallies,
  rallyPhase,
  RallyPhase,
  getRallyTimerState,
  planGroupLaunch,
  RALLY_BUFFER,
} from "../js/model.js";

test("parseMarchInput accepts mm:ss and bare seconds", () => {
  assert.equal(parseMarchInput("1:30"), 90);
  assert.equal(parseMarchInput("90"), 90);
  assert.equal(parseMarchInput("0:05"), 5);
});

test("parseMarchInput rejects garbage", () => {
  assert.ok(Number.isNaN(parseMarchInput("")));
  assert.ok(Number.isNaN(parseMarchInput("abc")));
  assert.ok(Number.isNaN(parseMarchInput("1:99"))); // seconds out of range
  assert.ok(Number.isNaN(parseMarchInput("1:2:3")));
});

test("parseUTCTimeToday rolls over to tomorrow if the time already passed", () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0); // 12:00:00 UTC
  const earlier = parseUTCTimeToday("11:00", now);
  const later = parseUTCTimeToday("13:00", now);
  assert.equal(later, Date.UTC(2026, 0, 1, 13, 0, 0));
  assert.equal(earlier, Date.UTC(2026, 0, 2, 11, 0, 0)); // pushed to next day
});

test("fmtMMSS formats and handles negatives", () => {
  assert.equal(fmtMMSS(90), "1:30");
  assert.equal(fmtMMSS(5), "0:05");
  assert.equal(fmtMMSS(-5), "-0:05");
});

test("sortRallies: soonest hit time on top", () => {
  const rallies = [
    { id: 1, hitTime: 3000, startAt: 1000 },
    { id: 2, hitTime: 1000, startAt: 500 },
    { id: 3, hitTime: 2000, startAt: 1500 },
  ];
  const sorted = sortRallies(rallies).map((r) => r.id);
  assert.deepEqual(sorted, [2, 3, 1]);
});

test("sortRallies: ties (synced group) broken by earliest start = longest march on top", () => {
  // All three hit at the same instant, but member A started marching first.
  const rallies = [
    { id: "short-march", hitTime: 5000, startAt: 4000 },
    { id: "long-march", hitTime: 5000, startAt: 1000 },
    { id: "mid-march", hitTime: 5000, startAt: 2500 },
  ];
  const sorted = sortRallies(rallies).map((r) => r.id);
  assert.deepEqual(sorted, ["long-march", "mid-march", "short-march"]);
});

test("sortRallies: a rally that just started still sorts correctly against still-scheduled ones", () => {
  // Regression test for the original bug: a rally whose sort key jumped to
  // hitTime the instant it started used to get shoved to the bottom of the
  // list even when its hit time was the soonest.
  const now = 10_000;
  const justStarted = { id: "A", startAt: now, hitTime: now + 60_000 };
  const stillScheduled = { id: "B", startAt: now + 5_000, hitTime: now + 120_000 };
  const sorted = sortRallies([stillScheduled, justStarted]).map((r) => r.id);
  assert.deepEqual(sorted, ["A", "B"]); // A hits first, so A stays on top
});

test("rallyPhase transitions scheduled -> marching -> hit", () => {
  const r = { startAt: 1000, hitTime: 2000 };
  assert.equal(rallyPhase(r, 500), RallyPhase.SCHEDULED);
  assert.equal(rallyPhase(r, 1500), RallyPhase.MARCHING);
  assert.equal(rallyPhase(r, 2000), RallyPhase.HIT);
  assert.equal(rallyPhase(r, 9999), RallyPhase.HIT);
});

test("getRallyTimerState flags imminent only while marching, not scheduled", () => {
  const r = { startAt: 1000, hitTime: 2000 };
  const scheduled = getRallyTimerState(r, 995); // 5s before start, hit is far off
  assert.equal(scheduled.isScheduled, true);
  assert.equal(scheduled.imminent, false);

  const marching = getRallyTimerState(r, 1993); // 7s before hit
  assert.equal(marching.isScheduled, false);
  assert.equal(marching.imminent, true);
});

test("planGroupLaunch (mode=now) makes every member share the same hit time", () => {
  const members = [
    { id: 1, marchTime: 30 },
    { id: 2, marchTime: 90 },
  ];
  const plan = planGroupLaunch(members, { mode: "now", launchDelay: 0 }, 0);
  assert.equal(plan[0].hitTime, plan[1].hitTime);
  // The longer march should start earlier (smaller/equal startAt).
  const long = plan.find((p) => p.person.marchTime === 90);
  const short = plan.find((p) => p.person.marchTime === 30);
  assert.ok(long.startAt <= short.startAt);
  assert.equal(long.startAt, 0); // longest marcher starts immediately
  assert.equal(long.hitTime, RALLY_BUFFER * 1000 + 90 * 1000);
});

test("planGroupLaunch (mode=target) returns null on unparsable time", () => {
  const members = [{ id: 1, marchTime: 30 }];
  const plan = planGroupLaunch(members, { mode: "target", targetTime: "not a time" }, 0);
  assert.equal(plan, null);
});
