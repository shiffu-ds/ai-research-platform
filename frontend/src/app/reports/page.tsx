import type { Metadata } from "next";
import { ReportLibrary } from "./ReportLibrary";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return <ReportLibrary />;
}
