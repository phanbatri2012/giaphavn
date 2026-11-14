import { Footer } from "@/components/footer";
import { MarketingHeader } from "@/components/marketing-header";

export default function PrivacyPage() {
  return <><MarketingHeader /><main className="legal-page container narrow"><span className="eyebrow"><i />Bản dự thảo cho pilot</span><h1>Chính sách bảo mật</h1><p>GiaPhaVN chỉ xử lý dữ liệu để cung cấp dịch vụ phả hệ theo chỉ dẫn của chủ sở hữu dòng họ. Dữ liệu nhạy cảm của người còn sống được ẩn khỏi website công khai theo mặc định.</p><h2>Dữ liệu được lưu</h2><p>Thông tin tài khoản, dữ liệu phả hệ, nội dung dòng họ, tệp được tải lên và lịch sử thao tác cần thiết cho bảo mật.</p><h2>Quyền của chủ sở hữu</h2><p>Chủ sở hữu có thể xuất dữ liệu, yêu cầu sửa hoặc xóa tenant. Yêu cầu xóa có thời gian chờ 30 ngày trước khi xóa vĩnh viễn.</p><h2>Lưu ý</h2><p>Nội dung này là bản kỹ thuật phục vụ pilot và cần được chuyên gia pháp lý Việt Nam duyệt trước khi mở đăng ký công khai.</p></main><Footer /></>;
}
