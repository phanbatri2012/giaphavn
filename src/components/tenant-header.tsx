"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const navItems = [
  ["Trang chủ", ""],
  ["Phả đồ", "/pha-do"],
  ["Tin tức", "/tin-tuc"],
  ["Sự kiện", "/su-kien"],
  ["Thư viện", "/thu-vien"],
  ["Phả ký", "/pha-ky"],
  ["Liên hệ", "/lien-he"]
];

export function TenantHeader({
  name,
  logoUrl,
  basePath,
  activePath,
  visiblePaths
}: {
  name: string;
  logoUrl?: string;
  basePath: string;
  activePath: string;
  visiblePaths?: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="tenant-header">
      <div className="tenant-container tenant-nav-row">
        <Link href={basePath || "/"} className="tenant-wordmark">
          {logoUrl ? <Image src={logoUrl} alt="" width={42} height={42} unoptimized /> : <span aria-hidden="true">家</span>}
          <strong>{name}</strong>
        </Link>
        <button
          className="tenant-menu-button"
          type="button"
          aria-expanded={open}
          aria-label={open ? "Đóng menu" : "Mở menu"}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? "tenant-nav open" : "tenant-nav"} aria-label="Điều hướng website dòng họ">
          {navItems.filter(([, path]) => !visiblePaths || visiblePaths.includes(path || "/")).map(([label, path]) => (
            <Link
              className={activePath === (path || "/") ? "active" : ""}
              href={`${basePath}${path}` || "/"}
              key={path}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
