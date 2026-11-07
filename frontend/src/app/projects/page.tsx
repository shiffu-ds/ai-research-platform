import type { Metadata } from "next";
import { Suspense } from "react";
import { Projects } from "./Projects";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <Suspense>
      <Projects />
    </Suspense>
  );
}
