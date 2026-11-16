"use client";

import {
  BookOpenText,
  GalleryHorizontalEnd,
  Globe2,
  HardDrive,
  LayoutDashboard,
  Menu,
  Network,
  Settings2,
  UsersRound,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brand } from "./brand";
import type { DashboardContext } from "@/lib/repository/current-tenant";

const navigation = [
  { label: "Tổng quan", href: "/admin", icon: LayoutDashboard },
  { label: "Phả đồ", href: "/admin/pha-do", icon: Network },
  { label: "Thành viên", href: "/admin/thanh-vien", icon: UsersRound },
  { label: "Bài viết & sự kiện", href: "/admin/noi-dung", icon: BookOpenText },
  { label: "Thư viện", href: "/admin/thu-vien", icon: GalleryHorizontalEnd },
  { label: "Giao diện website", href: "/admin/giao-dien", icon: Globe2 },
  { label: "Cài đặt", href: "/admin/cai-dat", icon: Settings2 }
];

export function DashboardShell({ children, context }: { children: React.ReactNode; context: DashboardContext }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="dashboard-shell">
      <aside className={open ? "dashboard-sidebar open" : "dashboard-sidebar"}>
        <div className="sidebar-brand-row">
          <Brand compact href="/admin" />
          <button type="button" aria-label="Đóng menu" onClick={() => setOpen(false)}><X /></button>
        </div>
        <div className="tenant-switcher">
          <span className="tenant-switcher-seal">{context.currentTenant.shortName.charAt(0).toUpperCase()}</span>
          <div>
            <small>Gia phả cá nhân</small>
            <strong>{context.currentTenant.shortName}</strong>
            <span>{context.trees.find((tree) => tree.id === context.currentTreeId)?.name}</span>
          </div>
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
        </nav>
        <div className="sidebar-plan">
          <div><span>Bản cá nhân</span><strong>{context.subscription.personCount} thành viên</strong></div>
          <p><HardDrive /> Dữ liệu được lưu trên máy này</p>
          <small>Không gói dịch vụ · không thanh toán</small>
        </div>
      </aside>
      {open && <button type="button" className="sidebar-scrim" aria-label="Đóng menu" onClick={() => setOpen(false)} />}
      <div className="dashboard-main-wrap">
        <header className="dashboard-topbar">
          <button className="dashboard-menu-button" type="button" aria-label="Mở menu" onClick={() => setOpen(true)}><Menu /></button>
          <div className="dashboard-topbar-context">
            <small>Không gian quản trị</small>
            <strong>{navigation.find((item) => item.href === pathname)?.label ?? "GiaPhaVN"}</strong>
          </div>
          <div className="dashboard-topbar-actions">
            <Link href="/" target="_blank"><Globe2 /> Xem website</Link>
            <span className="user-avatar" title={context.user.name}>{context.user.initials}</span>
          </div>
        </header>
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
