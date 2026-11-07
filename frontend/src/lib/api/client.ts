/**
 * The one place the UI talks to the backend.
 *
 * Live mode calls the REST contract under /api/v1. Demo mode serves the
 * dataset in mock-data.ts with a little latency, and applies mutations to
 * it in memory so the workspace behaves like a real one for the session.
 */

import type { Project } from "@/types/project.types";
import type { ProjectMember } from "@/types/project.types";
import type { ResearchRun, CreateResearchRunInput } from "@/types/research.types";
import type { Report, ReportVersion, HumanDecision } from "@/types/report.types";
import type { PlatformNotification } from "@/types/notification.types";
import type { Role } from "@/types/rbac.types";
import type {
  RunCompletionDataPoint,
  TokenExpenditureDataPoint,
  LatencyDistributionBucket,
  AgentPerformanceMetric,
  PlatformKpiSnapshot,
} from "@/types/analytics.types";
import type {
  SourceRecord,
  ResearchSchedule,
  PromptVersion,
  ModelConfig,
  QualityGate,
  GoldenSample,
  HealthReport,
} from "@/types/platform.types";
import { USE_MOCK, API_ORIGIN } from "./config";
import { http, ApiError } from "./http";
import * as demo from "./mock-data";

export { ApiError } from "./http";

const pause = (ms = 160 + Math.random() * 180) => new Promise((r) => setTimeout(r, ms));

function notFound(what: string): never {
  throw new ApiError(`${what} not found`, 404, "NOT_FOUND");
}

const clone = <T>(v: T): T => structuredClone(v);

export interface AnalyticsBundle {
  kpi: PlatformKpiSnapshot;
  runs: RunCompletionDataPoint[];
  tokens: TokenExpenditureDataPoint[];
  latency: LatencyDistributionBucket[];
  agents: AgentPerformanceMetric[];
}

export interface ReportBundle {
  report: Report;
  versions: ReportVersion[];
}

export const api = {
  // ── Projects ──────────────────────────────────────────────────
  async getProjects(): Promise<Project[]> {
    if (!USE_MOCK) return http<Project[]>("/projects");
    await pause();
    return clone(demo.MOCK_PROJECTS.filter((p) => !p.archivedAt));
  },

  async getProject(id: string): Promise<Project> {
    if (!USE_MOCK) return http<Project>(`/projects/${id}`);
    await pause();
    return clone(demo.MOCK_PROJECTS.find((p) => p.id === id) ?? notFound("Project"));
  },

  async createProject(input: { name: string; description: string }): Promise<Project> {
    if (!USE_MOCK) return http<Project>("/projects", { method: "POST", body: input });
    await pause(320);
    const now = new Date().toISOString();
    const project: Project = {
      id: `proj_${Math.random().toString(36).slice(2, 8)}`,
      name: input.name,
      description: input.description,
      ownerId: demo.DEMO_USER.id,
      membersCount: 1,
      stats: { totalRuns: 0, completedRuns: 0, totalReports: 0, totalSources: 0, contradictionsFound: 0 },
      createdAt: now,
      updatedAt: now,
    };
    demo.MOCK_PROJECTS.push(project);
    demo.MOCK_PROJECT_MEMBERS.push({
      id: `mem_${Date.now()}`,
      projectId: project.id,
      userId: demo.DEMO_USER.id,
      userName: demo.DEMO_USER.name,
      userEmail: demo.DEMO_USER.email,
      role: "OWNER",
      status: "ACTIVE",
      createdAt: now,
    });
    return clone(project);
  },

  // ── Research runs ─────────────────────────────────────────────
  async getResearchRuns(projectId?: string): Promise<ResearchRun[]> {
    if (!USE_MOCK) return http<ResearchRun[]>(projectId ? `/projects/${projectId}/research-runs` : "/research-runs");
    await pause();
    const runs = projectId ? demo.MOCK_RESEARCH_RUNS.filter((r) => r.projectId === projectId) : demo.MOCK_RESEARCH_RUNS;
    return clone([...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  async getResearchRun(runId: string): Promise<ResearchRun> {
    if (!USE_MOCK) return http<ResearchRun>(`/research-runs/${runId}`);
    await pause(120);
    return clone(demo.MOCK_RESEARCH_RUNS.find((r) => r.id === runId) ?? notFound("Research run"));
  },

  async createResearchRun(input: CreateResearchRunInput, creator: { id: string; name: string }): Promise<ResearchRun> {
    if (!USE_MOCK) {
      return http<ResearchRun>(`/projects/${input.projectId}/research-runs`, { method: "POST", body: input });
    }
    await pause(450);
    const now = new Date().toISOString();
    const run: ResearchRun = {
      id: `run_${Math.random().toString(36).slice(2, 8)}`,
      projectId: input.projectId,
      researchQuestionId: `rq_${Date.now()}`,
      questionText: input.questionText,
      state: "QUEUED",
      currentStage: "PLANNER",
      progressPercent: 0,
      createdBy: creator.id,
      creatorName: creator.name,
      config: input.config,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
      sourceCount: 0,
      evidenceCount: 0,
      contradictionCount: 0,
    };
    demo.MOCK_RESEARCH_RUNS.unshift(run);
    const project = demo.MOCK_PROJECTS.find((p) => p.id === input.projectId);
    if (project) project.stats.totalRuns += 1;
    return clone(run);
  },

  /** Demo-only: the simulated stream writes its outcome back to the run record. */
  syncDemoRun(runId: string, patch: Partial<ResearchRun>) {
    if (!USE_MOCK) return;
    const run = demo.MOCK_RESEARCH_RUNS.find((r) => r.id === runId);
    if (run) Object.assign(run, patch, { updatedAt: new Date().toISOString() });
  },

  async cancelResearchRun(runId: string, reason: string): Promise<void> {
    if (!USE_MOCK) return http<void>(`/research-runs/${runId}/cancel`, { method: "POST", body: { reason } });
    // In demo mode the simulated stream handles the state transition.
  },

  // ── Reports ───────────────────────────────────────────────────
  async getReports(projectId?: string): Promise<Report[]> {
    if (!USE_MOCK) return http<Report[]>(projectId ? `/projects/${projectId}/reports` : "/reports");
    await pause();
    const list = projectId ? demo.MOCK_REPORTS.filter((r) => r.projectId === projectId) : demo.MOCK_REPORTS;
    return clone([...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  },

  /** Accepts a report id or a version id (notifications link to either). */
  async getReport(idOrVersionId: string): Promise<ReportBundle> {
    if (!USE_MOCK) {
      const report = await http<Report>(`/reports/${idOrVersionId}`);
      const versions = await http<ReportVersion[]>(`/reports/${report.id}/versions`);
      return { report, versions };
    }
    await pause();
    const report =
      demo.getReportById(idOrVersionId) ??
      demo.getReportById(demo.MOCK_REPORT_VERSIONS[idOrVersionId]?.reportId ?? "") ??
      notFound("Report");
    return clone({ report, versions: demo.getReportVersionsByReportId(report.id) });
  },

  async getReportVersion(versionId: string): Promise<ReportVersion> {
    if (!USE_MOCK) return http<ReportVersion>(`/reports/versions/${versionId}`);
    await pause();
    return clone(demo.MOCK_REPORT_VERSIONS[versionId] ?? notFound("Report version"));
  },

  async getDecisions(reportVersionIds: string[]): Promise<HumanDecision[]> {
    if (!USE_MOCK) {
      const lists = await Promise.all(
        reportVersionIds.map((id) => http<HumanDecision[]>(`/reports/versions/${id}/decisions`))
      );
      return lists.flat();
    }
    await pause(120);
    return clone(
      demo.MOCK_HUMAN_DECISIONS.filter((d) => reportVersionIds.includes(d.reportVersionId)).sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      )
    );
  },

  async getAllDecisions(): Promise<HumanDecision[]> {
    if (!USE_MOCK) return http<HumanDecision[]>("/decisions");
    await pause(120);
    return clone(demo.MOCK_HUMAN_DECISIONS);
  },

  async recordDecision(decision: Omit<HumanDecision, "id" | "createdAt">): Promise<HumanDecision> {
    if (!USE_MOCK) {
      return http<HumanDecision>(`/reports/versions/${decision.reportVersionId}/decisions`, {
        method: "POST",
        body: decision,
      });
    }
    await pause(380);
    return clone(demo.recordHumanDecision(decision));
  },

  // ── Members ───────────────────────────────────────────────────
  async getMembers(projectId: string): Promise<ProjectMember[]> {
    if (!USE_MOCK) return http<ProjectMember[]>(`/projects/${projectId}/members`);
    await pause();
    return clone(demo.getMembersByProjectId(projectId));
  },

  async inviteMember(projectId: string, input: { name: string; email: string; role: Role }, invitedBy: string) {
    if (!USE_MOCK) {
      return http<ProjectMember>(`/projects/${projectId}/members`, { method: "POST", body: input });
    }
    await pause(400);
    const exists = demo.MOCK_PROJECT_MEMBERS.find(
      (m) => m.projectId === projectId && m.userEmail.toLowerCase() === input.email.toLowerCase() && m.status !== "REMOVED"
    );
    if (exists) throw new ApiError("Already a member", 409, "CONFLICT");
    return clone(
      demo.addProjectMember({
        projectId,
        userId: `usr_${Math.random().toString(36).slice(2, 8)}`,
        userName: input.name,
        userEmail: input.email,
        role: input.role,
        status: "INVITED",
        invitedBy,
      })
    );
  },

  async updateMemberRole(projectId: string, memberId: string, role: Role): Promise<ProjectMember> {
    if (!USE_MOCK) {
      return http<ProjectMember>(`/projects/${projectId}/members/${memberId}`, { method: "PATCH", body: { role } });
    }
    await pause(220);
    return clone(demo.updateMemberRole(memberId, role) ?? notFound("Member"));
  },

  async removeMember(projectId: string, memberId: string): Promise<void> {
    if (!USE_MOCK) return http<void>(`/projects/${projectId}/members/${memberId}`, { method: "DELETE" });
    await pause(200);
    if (!demo.removeMember(memberId)) notFound("Member");
  },

  async restoreMember(projectId: string, memberId: string, status: ProjectMember["status"]): Promise<void> {
    if (!USE_MOCK) {
      return http<void>(`/projects/${projectId}/members/${memberId}`, { method: "PATCH", body: { status } });
    }
    const m = demo.MOCK_PROJECT_MEMBERS.find((x) => x.id === memberId);
    if (m) m.status = status;
  },

  // ── Notifications ─────────────────────────────────────────────
  async getNotifications(): Promise<PlatformNotification[]> {
    if (!USE_MOCK) return http<PlatformNotification[]>("/notifications");
    await pause(100);
    return clone(demo.MOCK_NOTIFICATIONS);
  },

  // ── Sources ───────────────────────────────────────────────────
  async getSources(projectId?: string): Promise<SourceRecord[]> {
    if (!USE_MOCK) return http<SourceRecord[]>(projectId ? `/projects/${projectId}/sources` : "/sources");
    await pause();
    return clone(projectId ? demo.MOCK_SOURCES.filter((s) => s.projectId === projectId) : demo.MOCK_SOURCES);
  },

  // ── Schedules ─────────────────────────────────────────────────
  async getSchedules(projectId?: string): Promise<ResearchSchedule[]> {
    if (!USE_MOCK) return http<ResearchSchedule[]>(projectId ? `/projects/${projectId}/schedules` : "/schedules");
    await pause();
    return clone(projectId ? demo.MOCK_SCHEDULES.filter((s) => s.projectId === projectId) : demo.MOCK_SCHEDULES);
  },

  async saveSchedule(schedule: ResearchSchedule, isNew: boolean): Promise<ResearchSchedule> {
    if (!USE_MOCK) {
      return http<ResearchSchedule>(isNew ? `/projects/${schedule.projectId}/schedules` : `/schedules/${schedule.id}`, {
        method: isNew ? "POST" : "PUT",
        body: schedule,
      });
    }
    await pause(260);
    if (isNew) demo.MOCK_SCHEDULES.push(clone(schedule));
    else {
      const i = demo.MOCK_SCHEDULES.findIndex((s) => s.id === schedule.id);
      demo.MOCK_SCHEDULES[i] = clone(schedule);
    }
    return clone(schedule);
  },

  async deleteSchedule(id: string): Promise<void> {
    if (!USE_MOCK) return http<void>(`/schedules/${id}`, { method: "DELETE" });
    await pause(200);
    const i = demo.MOCK_SCHEDULES.findIndex((s) => s.id === id);
    if (i >= 0) demo.MOCK_SCHEDULES.splice(i, 1);
  },

  // ── Prompts & models ──────────────────────────────────────────
  async getPrompts(): Promise<PromptVersion[]> {
    if (!USE_MOCK) return http<PromptVersion[]>("/prompts");
    await pause();
    return clone(demo.MOCK_PROMPTS);
  },

  /** Activating a version deprecates the previously active one (registry.py set_status). */
  async activatePrompt(promptId: string, version: string): Promise<PromptVersion[]> {
    if (!USE_MOCK) {
      await http<void>(`/prompts/${promptId}/versions/${version}/activate`, { method: "POST" });
      return http<PromptVersion[]>("/prompts");
    }
    await pause(300);
    for (const p of demo.MOCK_PROMPTS) {
      if (p.promptId !== promptId) continue;
      if (p.version === version) p.status = "ACTIVE";
      else if (p.status === "ACTIVE") p.status = "DEPRECATED";
    }
    return clone(demo.MOCK_PROMPTS);
  },

  async getModels(): Promise<ModelConfig[]> {
    if (!USE_MOCK) return http<ModelConfig[]>("/models");
    await pause(100);
    return clone(demo.MOCK_MODELS);
  },

  // ── Evaluation & analytics ────────────────────────────────────
  async getQualityGates(): Promise<{ gates: QualityGate[]; samples: GoldenSample[]; measuredAt: string }> {
    if (!USE_MOCK) return http("/evaluation/latest");
    await pause();
    return clone({ gates: demo.MOCK_QUALITY_GATES, samples: demo.MOCK_GOLDEN_SAMPLES, measuredAt: "2026-09-25T06:00:00Z" });
  },

  async getAnalytics(): Promise<AnalyticsBundle> {
    if (!USE_MOCK) return http<AnalyticsBundle>("/analytics/overview");
    await pause();
    return clone({
      kpi: demo.MOCK_PLATFORM_KPI,
      runs: demo.MOCK_RUN_COMPLETION_SERIES,
      tokens: demo.MOCK_TOKEN_EXPENDITURE_SERIES,
      latency: demo.MOCK_LATENCY_DISTRIBUTION,
      agents: demo.MOCK_AGENT_PERFORMANCE,
    });
  },

  // ── Health (real in both modes when the backend is up) ────────
  async getHealth(): Promise<HealthReport> {
    const started = performance.now();
    if (USE_MOCK) {
      return { status: "demo", checks: {}, checkedAt: new Date().toISOString() };
    }
    try {
      const res = await fetch(`${API_ORIGIN}/health/ready`, { cache: "no-store" });
      const body = (await res.json()) as { status: "ready" | "not_ready"; checks: Record<string, string> };
      return {
        status: body.status,
        checks: body.checks ?? {},
        checkedAt: new Date().toISOString(),
        latencyMs: Math.round(performance.now() - started),
      };
    } catch {
      return { status: "unreachable", checks: {}, checkedAt: new Date().toISOString() };
    }
  },
};
