import { describe, it } from "node:test";
import assert from "node:assert";
import { formatLocalizedTime, formatRelativeTime } from "../../src/lib/utils/timezone";

describe("Timezone Localization Engine (§42 & GH-55)", () => {
  it("formats UTC timestamp accurately to specified timezone", () => {
    const utcString = "2026-09-25T12:00:00Z";
    const formattedUTC = formatLocalizedTime(utcString, "UTC", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    assert.match(formattedUTC, /12:00/);

    const formattedNY = formatLocalizedTime(utcString, "America/New_York", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    // UTC-4 in daylight savings
    assert.match(formattedNY, /08:00/);
  });

  it("handles empty or null timestamps gracefully", () => {
    assert.strictEqual(formatLocalizedTime(null), "—");
    assert.strictEqual(formatLocalizedTime(undefined), "—");
    assert.strictEqual(formatRelativeTime(null), "—");
  });
});
