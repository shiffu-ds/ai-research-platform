import type { Metadata } from "next";
import { Sources } from "./Sources";

export const metadata: Metadata = { title: "Sources" };

export default function SourcesPage() {
  return <Sources />;
}
