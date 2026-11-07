import type { Metadata } from "next";
import { Schedules } from "./Schedules";

export const metadata: Metadata = { title: "Schedules" };

export default function SchedulesPage() {
  return <Schedules />;
}
