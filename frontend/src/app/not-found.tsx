import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <EmptyState
      drawing="magnifier"
      title="We looked everywhere"
      action={
        <div className="flex gap-2">
          <ButtonLink href="/" variant="primary">
            Back to overview
          </ButtonLink>
          <ButtonLink href="/research">See research runs</ButtonLink>
        </div>
      }
    >
      This page doesn&apos;t exist, or it moved. If you followed a link from a notification, the run or report may have been removed.
    </EmptyState>
  );
}
