import Link from "next/link";
import { Brand } from "./brand";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Brand />
          <p>Một nơi trang trọng để mỗi dòng họ gìn giữ câu chuyện của mình.</p>
        </div>
        <div>
          <strong>Sản phẩm</strong>
          <Link href="/#tinh-nang">Tính năng</Link>
          <Link href="/bang-gia">Bảng giá</Link>
          <Link href="/site/demo-hong-viet">Website mẫu</Link>
        </div>
        <div>
          <strong>Hỗ trợ</strong>
          <Link href="/#quy-trinh">Bắt đầu</Link>
          <Link href="/chinh-sach-bao-mat">Chính sách bảo mật</Link>
          <Link href="/dieu-khoan">Điều khoản sử dụng</Link>
        </div>
        <div>
          <strong>Liên hệ</strong>
          <a href="mailto:hello@example.vn">hello@example.vn</a>
          <span>Đà Nẵng, Việt Nam</span>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 GiaPhaVN. Sản phẩm đang trong giai đoạn pilot.</span>
        <span>Dữ liệu của dòng họ thuộc về dòng họ.</span>
      </div>
    </footer>
  );
}
