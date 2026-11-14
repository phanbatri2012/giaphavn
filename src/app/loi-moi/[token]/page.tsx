import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { AcceptInvitationButton } from "@/components/invitation-actions";

export const metadata: Metadata = { title: "Lời mời quản trị", robots: { index: false } };
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; return <main className="auth-page"><section className="auth-story"><Brand href="/" /><div><span className="eyebrow light"><i />Cùng gìn giữ nguồn cội</span><h1>Bạn được mời chăm sóc một không gian dòng họ.</h1></div></section><section className="auth-panel"><div className="auth-panel-inner auth-message"><h2>Chấp nhận vai trò quản trị viên</h2><p>Hãy đăng nhập bằng đúng email nhận lời mời. Mọi thay đổi của quản trị viên đều được ghi audit.</p><AcceptInvitationButton token={token} /></div></section></main>; }

