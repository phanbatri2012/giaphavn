import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { PasswordRecoveryForm } from "@/components/password-recovery-form";

export const metadata: Metadata = { title: "Đặt mật khẩu mới", robots: { index: false } };
export default function ResetPasswordPage() { return <main className="auth-page"><section className="auth-story"><Brand href="/" /><div><span className="eyebrow light"><i />Phiên khôi phục</span><h1>Tạo một mật khẩu mới, dài và chỉ dùng tại GiaPhaVN.</h1></div><small>Không chia sẻ liên kết khôi phục với người khác.</small></section><section className="auth-panel"><div className="auth-panel-inner"><h2>Mật khẩu mới</h2><p>Dùng ít nhất 10 ký tự.</p><PasswordRecoveryForm mode="update" /><p className="auth-switch"><Link href="/dang-nhap">Quay lại đăng nhập</Link></p></div></section></main>; }

