import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const [{ data: admin }, assurance] = await Promise.all([
      supabase.from("platform_admins").select("user_id").maybeSingle(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    ]);
    if (!admin || assurance.data?.currentLevel !== "aal2") redirect("/app");
  }
  return children;
}
