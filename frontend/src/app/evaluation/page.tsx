import type { Metadata } from "next";
import { QualityGates } from "./QualityGates";

export const metadata: Metadata = { title: "Quality gates" };

export default function EvaluationPage() {
  return <QualityGates />;
}
