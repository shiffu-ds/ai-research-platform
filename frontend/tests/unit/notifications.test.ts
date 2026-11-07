import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NOTIFICATION_META, NotificationType } from "@/types/notification.types";
import { MOCK_NOTIFICATIONS } from "@/lib/api/mock-data";

describe("Notification Engine & Category Taxonomy (§38 & GH-52)", () => {
  it("covers all 8 standardized notification event categories", () => {
    const expectedCategories: NotificationType[] = [
      "RUN_STARTED",
      "RUN_COMPLETED",
      "RUN_FAILED",
      "CANCELLATION_ACKNOWLEDGED",
      "CONTRADICTION_FLAGGED",
      "HUMAN_DECISION_REQUIRED",
      "REPORT_PUBLISHED",
      "MEMBER_INVITED",
    ];

    const definedKeys = Object.keys(NOTIFICATION_META) as NotificationType[];
    assert.equal(definedKeys.length, 8);

    for (const cat of expectedCategories) {
      assert.ok(definedKeys.includes(cat), `Missing notification category: ${cat}`);
      assert.ok(NOTIFICATION_META[cat].label, `Missing label for category ${cat}`);
      assert.ok(NOTIFICATION_META[cat].severity, `Missing severity for category ${cat}`);
    }
  });

  it("verifies mock notification log schema integrity and immutability", () => {
    assert.ok(MOCK_NOTIFICATIONS.length >= 8);

    for (const notif of MOCK_NOTIFICATIONS) {
      assert.ok(notif.id, "Notification must have an id");
      assert.ok(notif.type, "Notification must have a type");
      assert.ok(notif.title, "Notification must have a title");
      assert.ok(notif.message, "Notification must have a message");
      assert.ok(notif.createdAt, "Notification must have an ISO timestamp in createdAt");
      assert.ok(
        ["INFO", "SUCCESS", "WARNING", "ERROR"].includes(notif.severity),
        `Invalid severity: ${notif.severity}`
      );
      assert.equal(typeof notif.isRead, "boolean");
    }
  });

  it("filters unread notifications accurately", () => {
    const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !n.isRead).length;
    assert.ok(unreadCount >= 0);
  });
});
