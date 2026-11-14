import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Brand } from "@/components/brand";

export const metadata: Metadata = { title: "Xác minh email", robots: { index: false } };
export default function VerifyEmailPage() { return <main className="auth-page"><section className="auth-story"><Brand href="/" /><div><span className="eyebrow light"><i />Một bước nữa</span><h1>Xác minh email để bảo vệ không gian dòng họ.</h1></div></section><section className="auth-panel"><div className="auth-panel-inner auth-message"><MailCheck /><h2>Kiểm tra hộp thư của bạn</h2><p>Chúng tôi đã gửi liên kết xác minh. Sau khi bấm liên kết, bạn sẽ tạo dòng họ và người gốc đầu tiên.</p><Link className="button button-primary button-wide" href="/dang-nhap">Quay lại đăng nhập</Link></div></section></main>; }

