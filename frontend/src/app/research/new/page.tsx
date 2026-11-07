import type { Metadata } from "next";
import { Suspense } from "react";
import { Composer } from "./Composer";

export const metadata: Metadata = { title: "New research" };

export default function NewResearchPage() {
  return (
    <Suspense>
      <Composer />
    </Suspense>
  );
}
