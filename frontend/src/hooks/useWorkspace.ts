"use client";

import { useQuery } from "@/lib/api/query";
import { api } from "@/lib/api/client";
import { useSession } from "@/stores/session.store";

export const qk = {
  projects: "projects",
  runs: (projectId?: string) => `runs:${projectId ?? "all"}`,
  run: (id: string) => `run:${id}`,
  reports: (projectId?: string) => `reports:${projectId ?? "all"}`,
  report: (id: string) => `report:${id}`,
  decisions: (ids: string[]) => `decisions:${ids.join(",")}`,
  allDecisions: "decisions:all",
  members: (projectId: string) => `members:${projectId}`,
  sources: (projectId?: string) => `sources:${projectId ?? "all"}`,
  schedules: (projectId?: string) => `schedules:${projectId ?? "all"}`,
  prompts: "prompts",
  models: "models",
  gates: "gates",
  analytics: "analytics",
};

/** Projects plus the one currently selected in the sidebar. */
export function useWorkspace() {
  const projects = useQuery(qk.projects, api.getProjects);
  const currentId = useSession((s) => s.currentProjectId);
  const setCurrentProjectId = useSession((s) => s.setCurrentProjectId);
  const list = projects.data ?? [];
  const project = list.find((p) => p.id === currentId) ?? list[0];
  return {
    projects: list,
    project,
    projectId: project?.id,
    isLoading: projects.isLoading,
    error: projects.error,
    setProject: setCurrentProjectId,
  };
}
