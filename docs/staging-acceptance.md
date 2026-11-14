# Cổng nghiệm thu staging

Tài liệu này là checklist bắt buộc trước khi mời 5 tenant pilot đầu tiên. Mỗi lần chạy phải lưu URL deployment, commit, thời gian, người thực hiện và bằng chứng vào ticket phát hành.

## 1. Điều kiện đầu vào

- Staging dùng Supabase project riêng tại Singapore; không dùng key hay database production.
- Vercel staging có root domain, `app` và wildcard tenant với TLS hợp lệ.
- `PUBLIC_REGISTRATION_ENABLED=false` và `PAYMENTS_ENABLED=false` cho tới khi các tích hợp tương ứng được nghiệm thu.
- Service-role key, PayOS checksum key, Resend key, Turnstile secret, cron secret và Sentry auth token chỉ có ở server.
- CI của commit deploy phải xanh: audit, typecheck, lint, unit, build, migration reset, pgTAP và E2E desktop/mobile.

## 2. Migration và RLS

Chạy migration trên local stack sạch qua CI trước. Sau đó link CLI tới **project staging đã được kiểm tra project ref**, rồi chỉ đẩy các migration tiến về trước:

```bash
npx supabase@3.1.0 link --project-ref STAGING_PROJECT_REF
npx supabase@3.1.0 db push
```

Sau deploy, dùng hai tài khoản thuộc hai tenant để xác nhận tenant A không đọc/sửa được person, tree, media, CMS hoặc URL tenant B. Gắn kết quả CI pgTAP và ảnh/chụp response 403/404 vào ticket. Không chạy reset trên project staging hay production.

## 3. Smoke test tự động trên deployment

PowerShell:

```powershell
$env:STAGING_BASE_URL = "https://staging.example.vn"
$env:STAGING_REQUIRE_SUPABASE = "true"
$env:STAGING_REQUIRE_HSTS = "true"
$env:STAGING_EXPECT_REGISTRATION_CLOSED = "true"
$env:STAGING_EXPECT_PAYMENTS_CLOSED = "true"
$env:STAGING_TENANT_URL = "https://tenant-pilot.staging.example.vn"
$env:STAGING_PUBLIC_TREE_ID = "TREE_UUID"
npm run test:staging
```

Lệnh kiểm tra health/Supabase mode, HTML, CSP nonce mới cho từng request, robots, sitemap, tenant site, public graph và trạng thái feature flag. Có thể bỏ hai biến tenant/tree trước khi tạo tenant staging, nhưng phải chạy lại đầy đủ trước pilot.

## 4. Luồng tích hợp cần tài khoản thật

- Auth: đăng ký, xác minh email, đăng nhập email/mật khẩu, Google OAuth, quên/đặt lại mật khẩu và phiên SSR.
- Resend: email xác minh, reset và mời admin vào inbox thật; link đúng staging domain và không lộ secret.
- Turnstile: đăng ký/contact thành công với token thật; token thiếu/sai và replay bị từ chối.
- Storage: ảnh hợp lệ upload/finalize được; file giả MIME, SVG và file quá hạn mức bị từ chối/xóa.
- PayOS sandbox/test: sai chữ ký bị từ chối; `returnUrl` không kích hoạt gói; webhook hợp lệ kích hoạt; webhook lặp không gia hạn lần hai; webhook đến trễ được đối soát đúng.
- Cron: bearer sai bị từ chối; bearer đúng chuyển subscription hết hạn sang `read_only`; public site và export vẫn dùng được.
- Operator: tài khoản ngoài allowlist bị chặn; operator allowlist nhưng chưa AAL2 bị chặn; thao tác hợp lệ có audit log và không có impersonation.

## 5. Hiệu năng, accessibility và phục hồi

- Chạy Lighthouse hoặc dữ liệu Vercel thực tế cho public site: p75 LCP dưới 2,5 giây.
- Ghi p95 mutation thường dưới 500 ms, không tính upload/export.
- Import 500 dòng dưới 30 giây; public tree 500 người tải dưới 4 giây trên mobile và dưới 2 giây trên desktop thử nghiệm.
- Playwright accessibility phải không có vi phạm WCAG A/AA tự động trên các màn hình chính; kiểm tra tay keyboard, focus, zoom 200% và screen reader cho luồng cốt lõi.
- Phục hồi backup database và media metadata vào project staging trống; đối chiếu số tenant/person/media/payment, mở ba cây ngẫu nhiên và tải một export. Ghi RPO, RTO và các bước thủ công.

## 6. Quyết định mở pilot

Chỉ mời 5 tenant khi không còn P0/P1, tất cả mục trên có bằng chứng và pháp lý Việt Nam đã duyệt. Mở 10 tenant sau khi PayOS idempotency và restore drill đạt; mở 20 tenant sau khi số liệu LCP/p95 đạt mục tiêu. Public registration vẫn đóng cho tới retrospective sau pilot.
