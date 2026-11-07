import { describe, it } from "node:test";
import assert from "node:assert";
import { can } from "../../src/types/rbac.types";

describe("RBAC Permission Matrix (§11.2.2 & §12.2.2)", () => {
  it("OWNER has full administrative rights", () => {
    assert.strictEqual(can("OWNER", "MANAGE_MEMBERS"), true);
    assert.strictEqual(can("OWNER", "DELETE_PROJECT"), true);
    assert.strictEqual(can("OWNER", "CREATE_RESEARCH_RUN"), true);
    assert.strictEqual(can("OWNER", "CANCEL_ANY_RUN"), true);
    assert.strictEqual(can("OWNER", "EDIT_PROMPTS"), true);
  });

  it("ADMIN can manage members and runs but cannot delete project", () => {
    assert.strictEqual(can("ADMIN", "MANAGE_MEMBERS"), true);
    assert.strictEqual(can("ADMIN", "DELETE_PROJECT"), false);
    assert.strictEqual(can("ADMIN", "CREATE_RESEARCH_RUN"), true);
    assert.strictEqual(can("ADMIN", "CANCEL_ANY_RUN"), true);
    assert.strictEqual(can("ADMIN", "EDIT_PROMPTS"), true);
  });

  it("RESEARCHER can create runs and cancel own runs only", () => {
    assert.strictEqual(can("RESEARCHER", "CREATE_RESEARCH_RUN"), true);
    assert.strictEqual(can("RESEARCHER", "CANCEL_OWN_RUN"), true);
    assert.strictEqual(can("RESEARCHER", "CANCEL_ANY_RUN"), false);
    assert.strictEqual(can("RESEARCHER", "MANAGE_MEMBERS"), false);
    assert.strictEqual(can("RESEARCHER", "EDIT_PROMPTS"), false);
  });

  it("ANALYST can view reports and approve decisions but cannot create runs", () => {
    assert.strictEqual(can("ANALYST", "VIEW_REPORTS"), true);
    assert.strictEqual(can("ANALYST", "APPROVE_HUMAN_DECISION"), true);
    assert.strictEqual(can("ANALYST", "CREATE_RESEARCH_RUN"), false);
    assert.strictEqual(can("ANALYST", "CANCEL_OWN_RUN"), false);
  });

  it("VIEWER is strictly read-only", () => {
    assert.strictEqual(can("VIEWER", "VIEW_REPORTS"), true);
    assert.strictEqual(can("VIEWER", "CREATE_RESEARCH_RUN"), false);
    assert.strictEqual(can("VIEWER", "APPROVE_HUMAN_DECISION"), false);
    assert.strictEqual(can("VIEWER", "MANAGE_MEMBERS"), false);
    assert.strictEqual(can("VIEWER", "EDIT_PROMPTS"), false);
  });
});
