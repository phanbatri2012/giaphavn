# Checklist vận hành GiaPhaVN cá nhân trên local

## Trước khi nhập dữ liệu thật

- Cài Node.js 22.5 trở lên và chạy `npm install`.
- Sao chép `.env.example` thành `.env.local`.
- Thay `TREE_ACCESS_COOKIE_SECRET` bằng chuỗi ngẫu nhiên tối thiểu 32 ký tự.
- Chạy `npm run dev`, kiểm tra `/`, `/pha-do` và `/admin`.
- Tại `/admin/cai-dat`, tải thử backup JSON và khôi phục lại.
- Upload thử một ảnh, dừng server rồi sao chép toàn bộ `.data` sang vị trí khác.

## Thói quen sao lưu

1. Dừng `npm run dev` trước khi sao chép trực tiếp database.
2. Sao chép toàn bộ `.data`, gồm `giaphavn.sqlite` và thư mục `media`.
3. Đặt tên thư mục backup theo ngày, ví dụ `giaphavn-backup-2026-11-16`.
4. Giữ ít nhất ba bản gần nhất trên một ổ đĩa hoặc thiết bị khác.
5. Mỗi tháng thử khôi phục một bản sao vào thư mục dự án thử nghiệm.

File JSON tải từ trang Cài đặt chứa cây, nội dung và cấu hình nhưng không nhúng dữ liệu nhị phân của ảnh. Sao chép `.data` mới là bản sao đầy đủ.

## Kiểm tra sau mỗi lần nâng cấp mã nguồn

```powershell
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Sau đó mở website và kiểm tra thủ công:

- tên tiếng Việt, dấu câu và font hiển thị đúng;
- thêm/sửa một thành viên rồi reload;
- tạo bài viết nháp và xuất bản;
- upload/xóa một ảnh album;
- khóa phả đồ bằng mã, thử mã sai và mã đúng;
- xuất XLSX/SVG/PDF và mở file kết quả.

## Giới hạn hiện tại

- Chỉ dùng trên máy local đáng tin cậy; `/admin` chưa có đăng nhập.
- Không chạy nhiều tiến trình ứng dụng cùng ghi một database.
- Không đồng bộ tự động sang cloud hoặc thiết bị khác.
- SQLite hiện lưu state đã kiểm tra trong một số bản ghi JSON; bước tiếp theo là chuẩn hóa thành các bảng nghiệp vụ.
- Chưa có lịch backup tự động hoặc giao diện quản lý nhiều phiên bản backup.

## Điều kiện trước khi mở qua LAN hoặc Internet

- Thêm đăng nhập quản trị local và giới hạn phiên.
- Chuyển media endpoint khỏi giới hạn `localhost` theo mô hình xác thực mới.
- Bật HTTPS, CSRF/rate limit phù hợp và kiểm tra header bảo mật.
- Thiết lập backup tự động, kiểm tra phục hồi và giám sát dung lượng.
- Chạy lại toàn bộ kiểm thử bảo mật và accessibility.
