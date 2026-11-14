import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { PasswordRecoveryForm } from "@/components/password-recovery-form";

export const metadata: Metadata = { title: "Quên mật khẩu" };
export default function ForgotPasswordPage() { return <main className="auth-page"><section className="auth-story"><Brand href="/" /><div><span className="eyebrow light"><i />Khôi phục an toàn</span><h1>Trở lại với những ký ức đang được gìn giữ.</h1></div><small>Liên kết chỉ được gửi đến email đã đăng ký.</small></section><section className="auth-panel"><div className="auth-panel-inner"><h2>Đặt lại mật khẩu</h2><p>Nhập email tài khoản để nhận liên kết bảo mật.</p><PasswordRecoveryForm mode="request" /><p className="auth-switch"><Link href="/dang-nhap">Quay lại đăng nhập</Link></p></div></section></main>; }

