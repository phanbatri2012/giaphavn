import type { Metadata } from "next";
import { Check, Crown } from "lucide-react";
import { PlanCheckoutButton } from "@/components/plan-checkout-button";
import { formatBytes, formatVnd } from "@/lib/domain/plans";
import { getDashboardContext } from "@/lib/repository/current-tenant";
import { getActivePlans, getPaymentOrders } from "@/lib/repository/plans";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Gói dịch vụ" };

export default async function SubscriptionPage() {
  const context = await getDashboardContext();
  const [plans, orders] = await Promise.all([getActivePlans(), getPaymentOrders(context.currentTenant.id)]);
  const subscription = context.subscription;
  const paymentsEnabled = !hasSupabaseConfig() || process.env.PAYMENTS_ENABLED === "true";
  return <div className="dashboard-page"><div className="dashboard-welcome compact"><div><span>Gói hiện tại: {subscription.planName}</span><h1>Gói dịch vụ</h1><p>{subscription.expiresAt ? `Hạn dùng đến ${new Intl.DateTimeFormat("vi-VN").format(new Date(subscription.expiresAt))}.` : "Gói hiện tại không có ngày hết hạn."} Dữ liệu không bị xóa khi gói hết hạn.</p></div><span className={`plan-active-badge ${subscription.status === "read_only" ? "warning" : ""}`}><Crown /> {subscription.status === "read_only" ? "Chỉ đọc" : "Đang hoạt động"}</span></div>{!paymentsEnabled && <p className="form-success">Thanh toán đang đóng theo feature flag trong giai đoạn pilot.</p>}<div className="admin-plan-grid">{plans.map((plan) => { const current = plan.id === subscription.planId; return <article className={current ? "dashboard-panel current" : "dashboard-panel"} key={plan.id}>{current && <span className="current-plan-label">Gói hiện tại</span>}<h2>{plan.name}</h2><strong>{formatVnd(plan.annualPrice)}</strong><small>{plan.annualPrice ? "/ năm" : "không hết hạn"}</small><ul><li><Check /> {plan.personLimit} thành viên</li><li><Check /> {plan.adminLimit} quản trị viên</li><li><Check /> {formatBytes(plan.storageLimitBytes)}</li><li><Check /> 5 phả đồ</li></ul>{plan.annualPrice > 0 ? <PlanCheckoutButton planId={plan.id} tenantId={context.currentTenant.id} label={current ? "Gia hạn 365 ngày" : "Chọn gói này"} disabled={!paymentsEnabled} /> : <button className="dashboard-secondary-button" disabled>Gói mặc định</button>}</article>; })}</div><section className="dashboard-panel payment-history"><div className="panel-heading"><div><span>Đối soát PayOS</span><h2>Lịch sử thanh toán</h2></div></div>{orders.length ? <div className="table-scroll"><table><thead><tr><th>Ngày tạo</th><th>Gói</th><th>Loại</th><th>Số tiền</th><th>Trạng thái</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{new Intl.DateTimeFormat("vi-VN").format(new Date(order.createdAt))}</td><td>{order.planName}</td><td>{order.kind}</td><td>{formatVnd(order.amount)}</td><td><span className={`status-chip ${order.status === "paid" ? "active" : "neutral"}`}>{order.status}</span></td></tr>)}</tbody></table></div> : <p className="empty-state">Chưa có giao dịch.</p>}</section></div>;
}
