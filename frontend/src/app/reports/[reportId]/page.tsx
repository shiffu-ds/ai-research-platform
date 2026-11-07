import type { Metadata } from "next";
import { ReportReader } from "@/components/reports/ReportReader";

export const metadata: Metadata = { title: "Report" };

export default async function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return <ReportReader reportId={reportId} />;
}
