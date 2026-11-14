"use client";

import { useMemo, useState } from "react";
import { Ban, Building2, CreditCard, Database, LockOpen, Search, ShieldCheck, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatBytes, formatVnd } from "@/lib/domain/plans";
import type { OpsSnapshot } from "@/lib/repository/ops";

export function OpsDashboard({ snapshot }: { snapshot: OpsSnapshot }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const filtered = useMemo(() => snapshot.tenants.filter((tenant) => `${tenant.name} ${tenant.slug}`.toLowerCase().includes(query.toLowerCase())), [query, snapshot.tenants]);

  async function action(tenantId: string, payload: object) {
    setBusy(tenantId);
    const response = await fetch(`/api/ops/tenants/${tenantId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    setBusy("");
    if (response.ok) router.refresh();
  }

  return <div className="dashboard-page ops-page"><div className="dashboard-welcome compact"><div><span>Chỉ tài khoản allowlist + MFA</span><h1>Điều hành pilot</h1><p>Theo dõi tenant thật mà không đăng nhập giả danh khách hàng.</p></div><span className="privacy-pill"><ShieldCheck /> Operator AAL2</span></div><div className="metric-grid ops-metrics"><article><span className="metric-icon rust"><Building2 /></span><div><small>Tenant</small><strong>{snapshot.metrics.tenantCount}</strong><p>Mục tiêu pilot 20</p></div></article><article><span className="metric-icon green"><UsersRound /></span><div><small>Người dùng</small><strong>{snapshot.metrics.userCount}</strong><p>Tài khoản quản trị</p></div></article><article><span className="metric-icon gold"><CreditCard /></span><div><small>Doanh thu</small><strong>{formatVnd(snapshot.metrics.revenue)}</strong><p>Giao dịch đã thanh toán</p></div></article><article><span className="metric-icon blue"><Database /></span><div><small>Dung lượng</small><strong>{formatBytes(snapshot.metrics.storageBytes)}</strong><p>Tổng media tenant</p></div></article></div><section className="dashboard-panel members-panel ops-table"><div className="table-toolbar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tenant hoặc slug…" /></label></div><div className="table-scroll"><table><thead><tr><th>Dòng họ</th><th>Gói</th><th>Sử dụng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{filtered.map((tenant) => <tr key={tenant.id}><td><strong>{tenant.name}</strong><small>{tenant.slug}</small></td><td>{tenant.planName}<small>{tenant.expiresAt ? `Đến ${new Intl.DateTimeFormat("vi-VN").format(new Date(tenant.expiresAt))}` : ""}</small></td><td>{tenant.personCount} người · {tenant.adminCount} admin<small>{formatBytes(tenant.storageBytes)}</small></td><td><span className={`status-chip ${tenant.locked ? "neutral" : "active"}`}>{tenant.locked ? "Đã khóa" : tenant.status}</span></td><td><div className="ops-actions"><button disabled={busy === tenant.id} onClick={() => action(tenant.id, { action: tenant.locked ? "unlock" : "lock" })}>{tenant.locked ? <LockOpen /> : <Ban />}{tenant.locked ? "Mở" : "Khóa"}</button><button disabled={busy === tenant.id} onClick={() => action(tenant.id, { action: "activate", planId: "community", days: 365 })}><CreditCard /> Đoàn viên +365</button></div></td></tr>)}</tbody></table></div></section><section className="dashboard-panel audit-list"><div className="panel-heading"><div><span>Append-only</span><h2>Audit gần nhất</h2></div></div>{snapshot.audit.map((item) => <div key={item.id}><code>{item.action}</code><span>{item.entityType}</span><time>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</time></div>)}</section></div>;
}
