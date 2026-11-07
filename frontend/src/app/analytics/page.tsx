import type { Metadata } from "next";
import { Observability } from "./Observability";

export const metadata: Metadata = { title: "Observability" };

export default function AnalyticsPage() {
  return <Observability />;
}
