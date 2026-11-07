"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/states";

export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      drawing="plug"
      title="This page tripped over something"
      action={
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => retry()}>
            Try again
          </Button>
          <ButtonLink href="/">Go to overview</ButtonLink>
        </div>
      }
    >
      It&apos;s on our side, not yours. Trying again usually works; if it doesn&apos;t, the details are in the browser console
      {error.digest ? <> (reference <code className="font-mono text-[12px]">{error.digest}</code>)</> : null}.
    </EmptyState>
  );
}
