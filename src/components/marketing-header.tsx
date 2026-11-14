"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Brand } from "./brand";

const links = [
  ["Tính năng", "/#tinh-nang"],
  ["Cách hoạt động", "/#quy-trinh"],
  ["Bảng giá", "/bang-gia"],
  ["Câu chuyện", "/#cau-chuyen"]
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="marketing-header">
      <div className="container nav-row">
        <Brand />
        <button
          className="mobile-menu-button"
          type="button"
          aria-label={open ? "Đóng menu" : "Mở menu"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? "marketing-nav is-open" : "marketing-nav"} aria-label="Điều hướng chính">
          {links.map(([label, href]) => (
            <Link href={href} key={href} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
          <Link className="button button-ghost button-small" href="/dang-nhap">
            Đăng nhập
          </Link>
          <Link className="button button-primary button-small" href="/dang-ky">
            Bắt đầu miễn phí
          </Link>
        </nav>
      </div>
    </header>
  );
}
