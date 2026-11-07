/**
 * In-app notifications. Scoped by project membership on the server.
 */

export type NotificationType =
  | "RUN_STARTED"
  | "RUN_COMPLETED"
  | "RUN_FAILED"
  | "CANCELLATION_ACKNOWLEDGED"
  | "CONTRADICTION_FLAGGED"
  | "HUMAN_DECISION_REQUIRED"
  | "REPORT_PUBLISHED"
  | "MEMBER_INVITED";

export type NotificationSeverity = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export interface PlatformNotification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  projectId?: string;
  projectName?: string;
  /** Links to the relevant resource (run, report, member) */
  resourceId?: string;
  resourceType?: "research_run" | "report" | "member";
  /** ISO UTC timestamp */
  createdAt: string;
  /** Whether the user has acknowledged/read this notification */
  isRead: boolean;
  /** For HUMAN_DECISION_REQUIRED, the report version that requires sign-off */
  reportVersionId?: string;
}

/** Maps each notification type to its visual metadata for rendering. */
export const NOTIFICATION_META: Record<
  NotificationType,
  { label: string; severity: NotificationSeverity; needsAction: boolean }
> = {
  RUN_STARTED: { label: "Run started", severity: "INFO", needsAction: false },
  RUN_COMPLETED: { label: "Run completed", severity: "SUCCESS", needsAction: false },
  RUN_FAILED: { label: "Run failed", severity: "ERROR", needsAction: true },
  CANCELLATION_ACKNOWLEDGED: { label: "Cancellation acknowledged", severity: "WARNING", needsAction: false },
  CONTRADICTION_FLAGGED: { label: "Contradiction flagged", severity: "WARNING", needsAction: true },
  HUMAN_DECISION_REQUIRED: { label: "Review needed", severity: "WARNING", needsAction: true },
  REPORT_PUBLISHED: { label: "Report published", severity: "SUCCESS", needsAction: false },
  MEMBER_INVITED: { label: "Member invited", severity: "INFO", needsAction: false },
};

/** Resolves where a notification should take the reader. */
export function notificationHref(n: PlatformNotification): string | undefined {
  if (!n.resourceId) return undefined;
  switch (n.resourceType) {
    case "research_run":
      return `/research/${n.resourceId}`;
    case "report":
      return `/reports/${n.resourceId}`;
    case "member":
      return "/members";
    default:
      return undefined;
  }
}
