import type { Metadata } from "next";
import { Check } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { MarketingHeader } from "@/components/marketing-header";
import { formatBytes, formatVnd } from "@/lib/domain/plans";
import { getActivePlans } from "@/lib/repository/plans";

export const metadata: Metadata = { title: "Bảng giá" };

export default async function PricingPage() {
  const plans = await getActivePlans();
  return (
    <>
      <MarketingHeader />
      <main className="subpage-main">
        <section className="subpage-hero">
          <div className="container narrow centered">
            <span className="eyebrow"><i />Bảng giá đơn giản</span>
            <h1>Chọn không gian phù hợp với dòng họ</h1>
            <p>Mọi gói đều có phả đồ, website riêng, bảo vệ bằng mã và khả năng xuất dữ liệu.</p>
          </div>
        </section>
        <section className="section compact-top">
          <div className="container pricing-grid pricing-full">
            {plans.map((plan) => (
              <article className={plan.highlighted ? "price-card highlighted" : "price-card"} key={plan.id}>
                {plan.highlighted && <span className="popular-label">Được đề xuất</span>}
                <h2>{plan.name}</h2>
                <strong>{formatVnd(plan.annualPrice)}</strong>
                <small>{plan.annualPrice > 0 ? "/ năm" : "miễn phí lâu dài"}</small>
                <ul>
                  <li><Check /> Tối đa {plan.personLimit} thành viên</li>
                  <li><Check /> {plan.adminLimit} quản trị viên</li>
                  <li><Check /> {formatBytes(plan.storageLimitBytes)} lưu trữ</li>
                  <li><Check /> Tối đa 5 phả đồ</li>
                  <li><Check /> Website theo tên miền phụ</li>
                  <li><Check /> Excel, SVG, PNG và PDF</li>
                </ul>
                <Link className={plan.highlighted ? "button button-primary" : "button button-ghost"} href="/dang-ky">
                  {plan.annualPrice ? `Chọn ${plan.name}` : "Bắt đầu miễn phí"}
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
