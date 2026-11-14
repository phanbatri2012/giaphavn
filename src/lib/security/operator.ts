import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getVerifiedOperator() {
  const supabase = await createSupabaseServerClient();
  const [{ data: auth }, assurance] = await Promise.all([supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if (!auth.user || assurance.data?.currentLevel !== "aal2") return undefined;
  const { data: admin } = await supabase.from("platform_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  return admin ? { userId: auth.user.id } : undefined;
}
