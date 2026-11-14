import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { SignInForm } from "@/components/sign-in-form";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Tạo tài khoản" };

export default function SignUpPage() {
  const registrationEnabled = !hasSupabaseConfig() || process.env.PUBLIC_REGISTRATION_ENABLED === "true";
  return (
    <main className="auth-page">
      <section className="auth-story signup-story">
        <Brand href="/" />
        <div>
          <span className="eyebrow light"><i />50 thành viên miễn phí</span>
          <h1>Bắt đầu từ một cái tên. Kết nối thành cả một dòng họ.</h1>
          <ul className="auth-benefits">
            <li>Không cần thẻ thanh toán</li>
            <li>Có website dòng họ ngay sau khi đăng ký</li>
            <li>Có thể xuất dữ liệu bất cứ lúc nào</li>
          </ul>
        </div>
        <small>Bằng việc đăng ký, bạn đồng ý với Điều khoản và Chính sách bảo mật.</small>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <h2>{registrationEnabled ? "Tạo không gian dòng họ" : "Pilot đang giới hạn đăng ký"}</h2>
          <p>{registrationEnabled ? "Chỉ mất vài phút để có phả đồ đầu tiên." : "GiaPhaVN đang mở theo từng nhóm dòng họ được mời. Hãy liên hệ Ban vận hành để tham gia pilot."}</p>
          {registrationEnabled && <SignInForm mode="signup" />}
          <p className="auth-switch">Đã có tài khoản? <Link href="/dang-nhap">Đăng nhập</Link></p>
        </div>
      </section>
    </main>
  );
}
