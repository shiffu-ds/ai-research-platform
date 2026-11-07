import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextRuns, toCron, describeSchedule, zonedTimeToUtc } from "../../src/lib/schedule";

describe("Recurring research schedules", () => {
  it("evaluates the time in the schedule's own timezone", () => {
    // 09:00 in Karachi (UTC+5) is 04:00 UTC.
    const from = new Date("2026-09-21T00:00:00Z"); // a Monday
    const [first] = nextRuns({ frequency: "daily", time: "09:00", timezone: "Asia/Karachi" }, from, 1);
    assert.equal(first.toISOString(), "2026-09-21T04:00:00.000Z");
  });

  it("skips weekends for weekday schedules", () => {
    const from = new Date("2026-09-25T12:00:00Z"); // Friday afternoon UTC
    const runs = nextRuns({ frequency: "weekdays", time: "07:30", timezone: "Europe/London" }, from, 2);
    // Next is Monday 28th 07:30 BST = 06:30 UTC, then Tuesday.
    assert.equal(runs[0].toISOString(), "2026-09-28T06:30:00.000Z");
    assert.equal(runs[1].toISOString(), "2026-09-29T06:30:00.000Z");
  });

  it("handles weekly and monthly cadences", () => {
    const from = new Date("2026-09-22T00:00:00Z");
    const weekly = nextRuns({ frequency: "weekly", dayOfWeek: 1, time: "09:00", timezone: "UTC" }, from, 2);
    assert.deepEqual(weekly.map((d) => d.toISOString()), ["2026-09-28T09:00:00.000Z", "2026-10-05T09:00:00.000Z"]);
    const monthly = nextRuns({ frequency: "monthly", dayOfMonth: 1, time: "10:00", timezone: "America/New_York" }, from, 1);
    // 1 Oct 10:00 EDT = 14:00 UTC
    assert.equal(monthly[0].toISOString(), "2026-10-01T14:00:00.000Z");
  });

  it("survives a daylight-saving transition", () => {
    // Europe/London leaves BST on 25 Oct 2026: 09:00 is 08:00 UTC before, 09:00 UTC after.
    const runs = nextRuns({ frequency: "daily", time: "09:00", timezone: "Europe/London" }, new Date("2026-10-24T00:00:00Z"), 2);
    assert.equal(runs[0].toISOString(), "2026-10-24T08:00:00.000Z");
    assert.equal(runs[1].toISOString(), "2026-10-25T09:00:00.000Z");
  });

  it("converts wall-clock time to UTC", () => {
    assert.equal(zonedTimeToUtc(2026, 9, 25, 12, 0, "Asia/Tokyo").toISOString(), "2026-09-25T03:00:00.000Z");
  });

  it("produces the equivalent cron and a readable description", () => {
    assert.equal(toCron({ frequency: "weekdays", time: "07:30" }), "30 7 * * 1-5");
    assert.equal(toCron({ frequency: "monthly", time: "10:00", dayOfMonth: 1 }), "0 10 1 * *");
    assert.equal(describeSchedule({ frequency: "weekly", time: "09:00", dayOfWeek: 1 }), "Every Monday at 09:00");
    assert.equal(describeSchedule({ frequency: "monthly", time: "10:00", dayOfMonth: 22 }), "Monthly on the 22nd at 10:00");
  });
});
