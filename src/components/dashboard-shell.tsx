"use client";

import {
  BookOpenText,
  ChevronDown,
  CreditCard,
  GalleryHorizontalEnd,
  Globe2,
  LayoutDashboard,
  Menu,
  Network,
  Settings2,
  ShieldCheck,
  UsersRound,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Brand } from "./brand";
import type { DashboardContext } from "@/lib/repository/current-tenant";

const navigation = [
  { label: "Tổng quan", href: "/app", icon: LayoutDashboard },
  { label: "Phả đồ", href: "/app/pha-do", icon: Network },
  { label: "Thành viên", href: "/app/thanh-vien", icon: UsersRound },
  { label: "Bài viết & sự kiện", href: "/app/noi-dung", icon: BookOpenText },
  { label: "Thư viện", href: "/app/thu-vien", icon: GalleryHorizontalEnd },
  { label: "Giao diện website", href: "/app/giao-dien", icon: Globe2 },
  { label: "Gói dịch vụ", href: "/app/goi-dich-vu", icon: CreditCard },
  { label: "Cài đặt", href: "/app/cai-dat", icon: Settings2 }
];

export function DashboardShell({ children, context }: { children: React.ReactNode; context: DashboardContext }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const usagePercent = Math.min(100, context.subscription.memberLimit ? (context.subscription.personCount / context.subscription.memberLimit) * 100 : 0);
  const daysRemaining = context.subscription.daysRemaining;

  async function selectContext(tenantId: string, treeId?: string) {
    setSwitching(true);
    const response = await fetch("/api/context", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId, treeId })
    });
    setSwitching(false);
    if (response.ok) router.refresh();
  }

  return (
    <div className="dashboard-shell">
      <aside className={open ? "dashboard-sidebar open" : "dashboard-sidebar"}>
        <div className="sidebar-brand-row">
          <Brand compact href="/app" />
          <button type="button" aria-label="Đóng menu" onClick={() => setOpen(false)}><X /></button>
        </div>
        <div className="tenant-switcher" aria-busy={switching}>
          <span className="tenant-switcher-seal">{context.currentTenant.shortName.charAt(0).toUpperCase()}</span>
          <div>
            <small>Đang quản lý</small>
            <label className="sr-only" htmlFor="tenant-context">Chọn dòng họ</label>
            <select id="tenant-context" value={context.currentTenant.id} disabled={switching} onChange={(event) => selectContext(event.target.value)}>
              {context.tenants.map((tenant) => <option value={tenant.id} key={tenant.id}>{tenant.shortName}</option>)}
            </select>
            <label className="sr-only" htmlFor="tree-context">Chọn phả đồ</label>
            <select id="tree-context" value={context.currentTreeId} disabled={switching} onChange={(event) => selectContext(context.currentTenant.id, event.target.value)}>
              {context.trees.map((tree) => <option value={tree.id} key={tree.id}>{tree.name}</option>)}
            </select>
          </div>
          <ChevronDown />
        </div>
        <nav className="dashboard-nav" aria-label="Quản trị dòng họ">
          <small>Quản lý</small>
          {navigation.map((item) => (
            <Link
              href={item.href}
              className={pathname === item.href ? "active" : ""}
              key={item.href}
              onClick={() => setOpen(false)}
            >
              <item.icon /> <span>{item.label}</span>
            </Link>
          ))}
          <small>Hệ thống</small>
          {context.isPlatformAdmin && <Link href="/app/ops" className={pathname === "/app/ops" ? "active" : ""} onClick={() => setOpen(false)}>
            <ShieldCheck /> <span>Điều hành pilot</span>
          </Link>}
        </nav>
        <div className="sidebar-plan">
          <div><span>Gói {context.subscription.planName}</span><strong>{context.subscription.personCount} / {context.subscription.memberLimit} thành viên</strong></div>
          <i><b style={{ width: `${usagePercent}%` }} /></i>
          <small>{context.subscription.status === "read_only" ? "Đang ở chế độ chỉ đọc" : daysRemaining === undefined ? "Không hết hạn" : `Còn ${daysRemaining} ngày sử dụng`}</small>
        </div>
      </aside>
      {open && <button type="button" className="sidebar-scrim" aria-label="Đóng menu" onClick={() => setOpen(false)} />}
      <div className="dashboard-main-wrap">
        <header className="dashboard-topbar">
          <button className="dashboard-menu-button" type="button" aria-label="Mở menu" onClick={() => setOpen(true)}><Menu /></button>
          <div className="dashboard-topbar-context">
            <small>Không gian quản trị</small>
            <strong>{navigation.find((item) => item.href === pathname)?.label ?? (pathname === "/app/ops" ? "Điều hành pilot" : "GiaPhaVN")}</strong>
          </div>
          <div className="dashboard-topbar-actions">
            <Link href={`/site/${context.currentTenant.slug}`} target="_blank"><Globe2 /> Xem website</Link>
            <span className="user-avatar" title={context.user.name}>{context.user.initials}</span>
          </div>
        </header>
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
