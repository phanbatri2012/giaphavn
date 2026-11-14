import { ArrowRight, BookHeart, FileSpreadsheet, Globe2, LockKeyhole, Network, Sparkles } from "lucide-react";
import Link from "next/link";
import { SectionEyebrow } from "@/components/brand";
import { Footer } from "@/components/footer";
import { HeroTree } from "@/components/hero-tree";
import { MarketingHeader } from "@/components/marketing-header";
import { formatVnd } from "@/lib/domain/plans";
import { getActivePlans } from "@/lib/repository/plans";

const features = [
  {
    icon: Network,
    title: "Phả đồ sống động",
    copy: "Dựng nhiều thế hệ, nhiều hôn phối; tìm kiếm, thu gọn nhánh và chia sẻ mà không cần cài đặt."
  },
  {
    icon: BookHeart,
    title: "Ký ức có chiều sâu",
    copy: "Lưu tiểu sử, ảnh, phả ký, sự kiện và câu chuyện để mỗi cái tên trở thành một cuộc đời."
  },
  {
    icon: Globe2,
    title: "Website riêng trang trọng",
    copy: "Mỗi dòng họ có một không gian riêng, đẹp trên mọi thiết bị và dễ cập nhật từ trang quản trị."
  },
  {
    icon: LockKeyhole,
    title: "Riêng tư từ thiết kế",
    copy: "Ẩn dữ liệu nhạy cảm của người còn sống và bảo vệ phả đồ bằng mã chia sẻ khi cần."
  },
  {
    icon: FileSpreadsheet,
    title: "Không nhập lại từ đầu",
    copy: "Đưa danh sách có sẵn vào bằng Excel, kiểm tra lỗi trước khi ghi và xuất bản sao bất cứ lúc nào."
  },
  {
    icon: Sparkles,
    title: "Dễ dùng cho Ban tộc biểu",
    copy: "Một quy trình rõ ràng để cùng quản lý thành viên, nội dung và hoạt động của dòng họ."
  }
];

export default async function MarketingPage() {
  const plans = await getActivePlans();
  return (
    <>
      <MarketingHeader />
      <main>
        <section className="hero-section">
          <div className="hero-paper-pattern" aria-hidden="true" />
          <div className="container hero-grid">
            <div className="hero-copy">
              <SectionEyebrow>Mỗi dòng họ, một di sản số</SectionEyebrow>
              <h1>
                Gìn giữ nguồn cội.
                <span>Kết nối mai sau.</span>
              </h1>
              <p>
                GiaPhaVN giúp Ban tộc biểu dựng phả đồ, lưu câu chuyện và tạo một website riêng để con cháu
                ở bất cứ đâu cũng có thể tìm về.
              </p>
              <div className="hero-actions">
                <Link className="button button-primary" href="/dang-ky">
                  Tạo gia phả miễn phí <ArrowRight size={18} />
                </Link>
                <Link className="text-link" href="/site/demo-hong-viet">
                  Khám phá website mẫu <ArrowRight size={16} />
                </Link>
              </div>
              <div className="trust-line">
                <span><i /> Không cần thẻ thanh toán</span>
                <span><i /> 50 thành viên miễn phí</span>
                <span><i /> Có thể xuất dữ liệu</span>
              </div>
            </div>
            <HeroTree />
          </div>
        </section>

        <section className="proof-strip">
          <div className="container proof-grid">
            <div><strong>5</strong><span>phả đồ cho mỗi dòng họ</span></div>
            <div><strong>500</strong><span>thành viên ở gói Đoàn viên</span></div>
            <div><strong>12 giờ</strong><span>phiên xem phả đồ riêng tư</span></div>
            <div><strong>100%</strong><span>dữ liệu có thể xuất ra</span></div>
          </div>
        </section>

        <section className="section" id="tinh-nang">
          <div className="container">
            <div className="section-heading centered">
              <SectionEyebrow>Một nơi cho cả dòng họ</SectionEyebrow>
              <h2>Từ phả đồ đến những câu chuyện còn mãi</h2>
              <p>Mọi công cụ cần thiết được sắp xếp theo đúng cách Ban tộc biểu làm việc.</p>
            </div>
            <div className="feature-grid">
              {features.map((feature, index) => (
                <article className="feature-card" key={feature.title}>
                  <span className="feature-number">0{index + 1}</span>
                  <feature.icon aria-hidden="true" />
                  <h3>{feature.title}</h3>
                  <p>{feature.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section story-section" id="cau-chuyen">
          <div className="container story-grid">
            <div className="story-visual" aria-hidden="true">
              <span className="story-ring ring-one" />
              <span className="story-ring ring-two" />
              <div className="story-card story-card-one"><b>1882</b><span>Một nhánh họ bắt đầu</span></div>
              <div className="story-card story-card-two"><b>2026</b><span>Bốn thế hệ cùng kết nối</span></div>
              <div className="story-seal">根</div>
            </div>
            <div>
              <SectionEyebrow>Không chỉ là những cái tên</SectionEyebrow>
              <h2>Mỗi người là một chương trong cuốn gia phả</h2>
              <p>
                Ngày sinh có thể chưa trọn vẹn. Một bức ảnh có thể đã phai. GiaPhaVN tôn trọng cả những dữ
                kiện chưa đầy đủ, để gia đình có thể bổ sung dần mà không đánh mất mối liên hệ giữa các thế hệ.
              </p>
              <ul className="check-list">
                <li>Ghi ngày theo năm, tháng hoặc ngày đầy đủ</li>
                <li>Phân biệt quan hệ sinh học, nhận nuôi và giám hộ</li>
                <li>Ẩn thông tin nhạy cảm của người còn sống</li>
              </ul>
              <Link className="text-link" href="/site/demo-hong-viet/pha-do">
                Xem phả đồ mẫu <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        <section className="section process-section" id="quy-trinh">
          <div className="container">
            <div className="section-heading centered">
              <SectionEyebrow>Bắt đầu nhẹ nhàng</SectionEyebrow>
              <h2>Ba bước để có website dòng họ</h2>
            </div>
            <div className="process-grid">
              {[
                ["01", "Tạo không gian", "Đặt tên dòng họ, chọn địa chỉ website và thêm người gốc."],
                ["02", "Dựng phả đồ", "Thêm từng người hoặc nhập danh sách Excel có sẵn."],
                ["03", "Mời con cháu về", "Xuất bản website, chia sẻ liên kết hoặc mã bảo mật."]
              ].map(([number, title, copy]) => (
                <article key={number}>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section pricing-preview">
          <div className="container">
            <div className="section-heading split-heading">
              <div>
                <SectionEyebrow>Minh bạch từ đầu</SectionEyebrow>
                <h2>Bắt đầu miễn phí, lớn lên cùng dòng họ</h2>
              </div>
              <p>Không khóa dữ liệu. Khi cần nhiều thành viên hoặc quản trị viên hơn, bạn mới phải nâng cấp.</p>
            </div>
            <div className="pricing-grid">
              {plans.map((plan) => (
                <article className={plan.highlighted ? "price-card highlighted" : "price-card"} key={plan.id}>
                  {plan.highlighted && <span className="popular-label">Phù hợp nhất cho pilot</span>}
                  <h3>{plan.name}</h3>
                  <strong>{formatVnd(plan.annualPrice)}</strong>
                  <small>{plan.annualPrice > 0 ? "/ năm" : "dùng không giới hạn thời gian"}</small>
                  <ul>
                    <li>{plan.personLimit} thành viên</li>
                    <li>{plan.adminLimit} quản trị viên</li>
                    <li>Website dòng họ riêng</li>
                    <li>Nhập và xuất dữ liệu</li>
                  </ul>
                  <Link className={plan.highlighted ? "button button-primary" : "button button-ghost"} href="/dang-ky">
                    {plan.annualPrice ? "Chọn gói này" : "Bắt đầu miễn phí"}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="final-cta">
          <div className="container final-cta-inner">
            <div>
              <SectionEyebrow>Một việc hôm nay, giá trị nhiều đời</SectionEyebrow>
              <h2>Bắt đầu ghi lại câu chuyện của dòng họ bạn</h2>
            </div>
            <Link className="button button-light" href="/dang-ky">
              Tạo gia phả đầu tiên <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
