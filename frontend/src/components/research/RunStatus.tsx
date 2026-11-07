import { Badge, type Tone } from "@/components/ui/Badge";
import { getStateCategory, isRunActive, STATE_LABEL, type ResearchRunState, type StateCategory } from "@/types/research.types";

export const CATEGORY_TONE: Record<StateCategory, Tone> = {
  intake: "intake",
  process: "process",
  validation: "validation",
  control: "control",
  success: "success",
  failure: "failure",
};

export function RunStatus({ state, className }: { state: ResearchRunState; className?: string }) {
  const tone = CATEGORY_TONE[getStateCategory(state)];
  return (
    <Badge tone={tone} dot pulse={isRunActive(state)} className={className}>
      {STATE_LABEL[state]}
    </Badge>
  );
}
