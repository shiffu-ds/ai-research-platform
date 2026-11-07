"use client";

import { Plus } from "lucide-react";
import { useQuery } from "@/lib/api/query";
import { api } from "@/lib/api/client";
import { qk, useWorkspace } from "@/hooks/useWorkspace";
import { useCan } from "@/hooks/useSession";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/misc";
import { ErrorState } from "@/components/ui/states";
import { RunsTable } from "@/components/research/RunsTable";

export function ResearchIndex() {
  const { projectId, project } = useWorkspace();
  const runs = useQuery(projectId ? qk.runs(projectId) : null, () => api.getResearchRuns(projectId));
  const canCreate = useCan("CREATE_RESEARCH_RUN");

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader
        eyebrow={project?.name}
        title="Research"
        description="Each run takes a question through planning, source discovery, retrieval, evidence extraction, conflict checks and a validated report."
        actions={
          canCreate ? (
            <ButtonLink href="/research/new" variant="primary" icon={<Plus className="h-3.5 w-3.5" />}>
              New research
            </ButtonLink>
          ) : undefined
        }
      />
      {runs.error && !runs.data ? (
        <ErrorState error={runs.error} onRetry={runs.refetch} />
      ) : !runs.data ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : (
        <RunsTable runs={runs.data} canCreate={canCreate} />
      )}
    </div>
  );
}
