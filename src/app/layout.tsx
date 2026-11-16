import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { connection } from "next/server";
import "@fontsource-variable/noto-sans/wght.css";
import "@fontsource-variable/noto-serif/wght.css";
import "@fontsource-variable/noto-serif/wght-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_ROOT_URL ?? "http://localhost:3000"),
  title: {
    default: "GiaPhaVN — Gìn giữ nguồn cội",
    template: "%s | GiaPhaVN"
  },
  description:
    "Không gian gia phả riêng để gìn giữ phả đồ, ký ức và câu chuyện của một dòng họ.",
  openGraph: {
    title: "GiaPhaVN — Gìn giữ nguồn cội",
    description: "Phả đồ và ký ức số của dòng họ.",
    type: "website",
    locale: "vi_VN"
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // A per-request nonce is injected by proxy.ts, so every HTML response must be dynamic.
  await connection();
  return (
    <html lang="vi">
      <body>{children}<Analytics /><SpeedInsights /></body>
    </html>
  );
}
