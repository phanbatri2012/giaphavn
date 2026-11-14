import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { OnboardingForm } from "@/components/onboarding-form";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tạo dòng họ", robots: { index: false } };
export default async function CreateTenantPage() {
  let registrationEnabled = true;
  if (hasSupabaseConfig()) {
    registrationEnabled = process.env.PUBLIC_REGISTRATION_ENABLED === "true";
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) redirect("/dang-nhap");
    if (!auth.user.email_confirmed_at) redirect("/xac-minh-email");
    const { data: membership } = await supabase.from("memberships").select("tenant_id").limit(1).maybeSingle();
    if (membership) redirect("/app");
  }
  if (!registrationEnabled) {
    return <main className="auth-page"><section className="auth-story signup-story"><Brand href="/" /><div><span className="eyebrow light"><i />Pilot có kiểm soát</span><h1>Không gian mới đang được mở theo từng đợt.</h1><p>Tài khoản của bạn đã sẵn sàng, nhưng tính năng tạo dòng họ hiện do Ban vận hành mở theo lịch pilot.</p></div></section><section className="auth-panel"><div className="auth-panel-inner onboarding-panel-auth"><h2>Chưa thể tạo dòng họ</h2><p>Vui lòng liên hệ Ban vận hành để được xếp vào đợt pilot tiếp theo.</p></div></section></main>;
  }
  return <main className="auth-page"><section className="auth-story signup-story"><Brand href="/" /><div><span className="eyebrow light"><i />Bước 1 / 4</span><h1>Đặt nền móng cho không gian dòng họ.</h1><p>Tên và địa chỉ có thể chỉnh sau; slug cần chọn ngắn, dễ nhớ.</p></div></section><section className="auth-panel"><div className="auth-panel-inner onboarding-panel-auth"><h2>Tạo dòng họ đầu tiên</h2><p>Bắt đầu bằng người gốc, sau đó thêm cha mẹ, hôn phối và con.</p><OnboardingForm /></div></section></main>;
}
