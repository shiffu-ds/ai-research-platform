/**
 * Roles and the permission matrix. The backend is the final authority;
 * the client uses this only to decide what to show and enable.
 */

export type Role = "OWNER" | "ADMIN" | "RESEARCHER" | "ANALYST" | "VIEWER";

export const ROLES: Role[] = ["OWNER", "ADMIN", "RESEARCHER", "ANALYST", "VIEWER"];

export type RoleStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED";

export type Action =
  | "MANAGE_MEMBERS"
  | "DELETE_PROJECT"
  | "CREATE_RESEARCH_RUN"
  | "CANCEL_ANY_RUN"
  | "CANCEL_OWN_RUN"
  | "VIEW_REPORTS"
  | "APPROVE_HUMAN_DECISION"
  | "EDIT_PROMPTS"
  | "VIEW_AUDIT_LOG";

export const PERMISSION_MATRIX: Record<Role, Record<Action, boolean>> = {
  OWNER: {
    MANAGE_MEMBERS: true,
    DELETE_PROJECT: true,
    CREATE_RESEARCH_RUN: true,
    CANCEL_ANY_RUN: true,
    CANCEL_OWN_RUN: true,
    VIEW_REPORTS: true,
    APPROVE_HUMAN_DECISION: true,
    EDIT_PROMPTS: true,
    VIEW_AUDIT_LOG: true,
  },
  ADMIN: {
    MANAGE_MEMBERS: true,
    DELETE_PROJECT: false,
    CREATE_RESEARCH_RUN: true,
    CANCEL_ANY_RUN: true,
    CANCEL_OWN_RUN: true,
    VIEW_REPORTS: true,
    APPROVE_HUMAN_DECISION: true,
    EDIT_PROMPTS: true,
    VIEW_AUDIT_LOG: true,
  },
  RESEARCHER: {
    MANAGE_MEMBERS: false,
    DELETE_PROJECT: false,
    CREATE_RESEARCH_RUN: true,
    CANCEL_ANY_RUN: false,
    CANCEL_OWN_RUN: true,
    VIEW_REPORTS: true,
    APPROVE_HUMAN_DECISION: true,
    EDIT_PROMPTS: false,
    VIEW_AUDIT_LOG: false,
  },
  ANALYST: {
    MANAGE_MEMBERS: false,
    DELETE_PROJECT: false,
    CREATE_RESEARCH_RUN: false,
    CANCEL_ANY_RUN: false,
    CANCEL_OWN_RUN: false,
    VIEW_REPORTS: true,
    APPROVE_HUMAN_DECISION: true,
    EDIT_PROMPTS: false,
    VIEW_AUDIT_LOG: false,
  },
  VIEWER: {
    MANAGE_MEMBERS: false,
    DELETE_PROJECT: false,
    CREATE_RESEARCH_RUN: false,
    CANCEL_ANY_RUN: false,
    CANCEL_OWN_RUN: false,
    VIEW_REPORTS: true,
    APPROVE_HUMAN_DECISION: false,
    EDIT_PROMPTS: false,
    VIEW_AUDIT_LOG: false,
  },
};

/** Checks if a given role is authorized to perform an action. */
export function can(role: Role, action: Action): boolean {
  return PERMISSION_MATRIX[role]?.[action] ?? false;
}

/**
 * Whether `role` may cancel a run created by `runOwnerId`, given the
 * acting user's id. Researchers may only cancel their own runs.
 */
export function canCancelRun(role: Role, actingUserId: string, runOwnerId: string): boolean {
  if (can(role, "CANCEL_ANY_RUN")) return true;
  return can(role, "CANCEL_OWN_RUN") && actingUserId === runOwnerId;
}

export const ROLE_META: Record<Role, { label: string; blurb: string }> = {
  OWNER: { label: "Owner", blurb: "Everything, including deleting the project." },
  ADMIN: { label: "Admin", blurb: "Runs the project day to day and manages the team." },
  RESEARCHER: { label: "Researcher", blurb: "Starts runs, cancels their own, signs off reports." },
  ANALYST: { label: "Analyst", blurb: "Reads reports and records decisions." },
  VIEWER: { label: "Viewer", blurb: "Read-only access to reports." },
};

export const ACTION_LABEL: Record<Action, string> = {
  MANAGE_MEMBERS: "Invite and manage members",
  DELETE_PROJECT: "Delete the project",
  CREATE_RESEARCH_RUN: "Start research runs",
  CANCEL_ANY_RUN: "Cancel anyone's run",
  CANCEL_OWN_RUN: "Cancel own runs",
  VIEW_REPORTS: "Read reports",
  APPROVE_HUMAN_DECISION: "Record decisions on reports",
  EDIT_PROMPTS: "Edit prompts and model routing",
  VIEW_AUDIT_LOG: "View the audit log",
};

/** Policy overrides bypass normal sign-off, so only owners and admins may record them. */
export function canOverridePolicy(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}
