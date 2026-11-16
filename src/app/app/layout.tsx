import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/repository/current-tenant";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (process.env.APP_MODE === "saas" && hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims) redirect("/dang-nhap");
  }
  const context = await getDashboardContext();
  return <DashboardShell context={context}>{children}</DashboardShell>;
}
