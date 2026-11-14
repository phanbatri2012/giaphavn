import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { SignInForm } from "@/components/sign-in-form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function SignInPage() {
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand href="/" />
        <div>
          <span className="eyebrow light"><i />Không gian dành cho Ban tộc biểu</span>
          <h1>Mỗi lần cập nhật hôm nay là một ký ức được giữ lại.</h1>
          <blockquote>“Cây có cội, nước có nguồn. Người trong một họ có chung một câu chuyện.”</blockquote>
        </div>
        <small>Dữ liệu nhạy cảm được ẩn khỏi website công khai theo mặc định.</small>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <h2>Chào mừng trở lại</h2>
          <p>Đăng nhập để tiếp tục chăm sóc không gian dòng họ.</p>
          <SignInForm mode="signin" />
          <p className="auth-switch">Chưa có tài khoản? <Link href="/dang-ky">Bắt đầu miễn phí</Link></p>
        </div>
      </section>
    </main>
  );
}
