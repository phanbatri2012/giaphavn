import type { Metadata } from "next";
import { OpsDashboard } from "@/components/ops-dashboard";
import { getOpsSnapshot } from "@/lib/repository/ops";

export const metadata: Metadata = { title: "Điều hành pilot" };

export default async function OpsPage() {
  return <OpsDashboard snapshot={await getOpsSnapshot()} />;
}
