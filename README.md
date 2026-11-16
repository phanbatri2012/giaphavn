# GiaPhaVN Personal Edition

GiaPhaVN là website gia phả **không thương mại**, dành riêng cho một dòng họ. Ứng dụng chạy trên một máy, có website công khai và khu vực quản trị nội bộ; không có gói dịch vụ, thanh toán, đăng ký tenant hay quản trị nền tảng.

Phiên bản SaaS trước khi chuyển đổi được lưu tại Git tag `saas-baseline-2026-11-16`.

## Chạy local

Yêu cầu Node.js 22.5 trở lên (khuyến nghị bản LTS hiện hành).

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Mở các địa chỉ:

- `http://localhost:3000` — trang chủ dòng họ.
- `http://localhost:3000/pha-do` — phả đồ công khai.
- `http://localhost:3000/tin-tuc`, `/su-kien`, `/thu-vien`, `/pha-ky`, `/lien-he` — nội dung dòng họ.
- `http://localhost:3000/admin` — khu vực quản trị local.
- `http://localhost:3000/admin/pha-do` — chỉnh sửa phả đồ và thành viên.

Các URL SaaS cũ như `/app`, `/dang-nhap`, `/dang-ky`, `/bang-gia` được chuyển hướng sang khu vực phù hợp. API thanh toán, operator, mời quản trị viên và tạo tenant trả về HTTP 410 trong Personal Edition.

## Dữ liệu local

Dữ liệu được lưu trong SQLite tại `.data/giaphavn.sqlite`. Thư mục `.data` đã được Git bỏ qua và không được đẩy lên repository.

- `PERSONAL_DATABASE_FILE` đổi tên file SQLite, nhưng file luôn nằm trong `.data/`.
- Nếu có `.data/demo-state.json` từ phiên bản cũ, ứng dụng tự nhập dữ liệu đó vào SQLite ở lần đọc đầu tiên.
- Có thể tải hoặc khôi phục file backup JSON (cây, nội dung và cấu hình) tại **Quản trị → Cài đặt → Dữ liệu gia phả local**.
- Ảnh nằm ở `.data/media`; sao chép cả thư mục `.data` khi cần một bản sao đầy đủ gồm ảnh.
- Có thể khôi phục dữ liệu mẫu tại cùng màn hình; thao tác này thay thế dữ liệu hiện tại.
- Không chạy đồng thời nhiều tiến trình GiaPhaVN trên cùng một file database.

Trước khi nhập dữ liệu thật, nên sao lưu toàn bộ thư mục `.data` khi server đã dừng.
Checklist vận hành chi tiết nằm tại [`docs/personal-local-checklist.md`](docs/personal-local-checklist.md).

## Phạm vi hiện tại

- Một dòng họ và một phả đồ chính.
- Website dòng họ responsive với trang phả đồ, tin tức, sự kiện, thư viện, phả ký và liên hệ.
- Thêm, sửa, lưu trữ và phục hồi thành viên.
- Tạo/gỡ quan hệ cha mẹ–con, hôn phối và kiểm tra chu trình.
- Tìm kiếm tên tiếng Việt không dấu, pan/zoom, thu gọn nhánh và giới hạn số đời.
- Optimistic concurrency bằng `graph_version` để tránh ghi đè thay đổi cũ.
- Import Excel hai bước và export XLSX/SVG/PNG/PDF.
- Thiết lập quyền riêng tư và public projection cho dữ liệu người còn sống.
- Phả đồ bảo vệ bằng mã Argon2id lưu trong SQLite; phiên mở khóa dùng cookie HttpOnly 12 giờ.
- Bài viết, sự kiện, album, lời nhắn, giao diện website và ảnh upload local được lưu cho một dòng họ.

Chưa bật đăng nhập, email, thanh toán hoặc triển khai thương mại. `/admin` hiện dành cho máy local đáng tin cậy; không đưa website ra Internet trước khi bổ sung xác thực quản trị, sao lưu/khôi phục và rà soát bảo mật.

## Cấu hình chính

```dotenv
APP_MODE=personal
PERSONAL_FAMILY_SLUG=demo-hong-viet
LOCAL_DEMO_PERSISTENCE=true
PERSONAL_DATABASE_FILE=giaphavn.sqlite
PUBLIC_REGISTRATION_ENABLED=false
PAYMENTS_ENABLED=false
```

Supabase, Google OAuth, Resend và PayOS không cần thiết cho chế độ cá nhân local.

## Kiểm tra mã nguồn

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

## Cấu trúc chính

```text
src/app/                 Trang công khai, quản trị và API
src/components/          Giao diện, trình xem/sửa cây và biểu mẫu
src/lib/demo/            Repository phả đồ cá nhân hiện tại
src/lib/personal/        Kết nối SQLite của Personal Edition
src/lib/domain/          Quy tắc phả hệ và quyền riêng tư
src/lib/import-export/   Import Excel và export SVG/PNG/PDF
tests/unit/              Kiểm thử nghiệp vụ
tests/e2e/               Kiểm thử trình duyệt desktop/mobile
supabase/                Di sản của bản SaaS, không cần để chạy local cá nhân
```

## Hướng phát triển kế tiếp

1. Chuẩn hóa schema SQLite thành các bảng `persons`, `unions`, `parentage_links`, nội dung và media thay vì một state JSON nguyên khối.
2. Bổ sung lịch sử và tự động luân phiên các bản sao lưu định kỳ.
3. Thêm một tài khoản quản trị local trước khi cho phép truy cập qua mạng LAN/Internet.
4. Hoàn thiện import/export, kiểm thử cây lớn và đóng gói triển khai cá nhân.
