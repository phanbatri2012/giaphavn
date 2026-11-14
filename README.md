# GiaPhaVN

Nền tảng SaaS nhiều dòng họ để dựng phả đồ, lưu ký ức và xuất bản website riêng. Sản phẩm dùng thương hiệu, giao diện và mã nguồn mới; chỉ tham khảo luồng nghiệp vụ của các nền tảng gia phả hiện có.

## Bản chạy hiện tại

Không cần biến môi trường để xem dữ liệu mẫu:

```bash
npm install
npm run dev
```

Các địa chỉ chính:

- `http://localhost:3000` — website giới thiệu và bảng giá.
- `http://localhost:3000/site/demo-hong-viet` — website dòng họ mẫu.
- `http://localhost:3000/site/demo-hong-viet/pha-do` — phả đồ tương tác.
- `http://localhost:3000/app` — dashboard quản trị (dữ liệu mẫu nếu chưa cấu hình Supabase).
- `http://localhost:3000/app/ops` — dashboard operator; production yêu cầu allowlist + MFA AAL2.

Khi chưa có Supabase, ứng dụng tự chuyển sang repository demo chỉ đọc; thao tác thêm người trong phả đồ chỉ tồn tại trong phiên trình duyệt. Khi có đủ biến môi trường Supabase, auth, RLS, tenant và transaction thật được dùng.

## Phạm vi đã hiện thực

- Next.js App Router + TypeScript, marketing site, dashboard và public tenant site SSR.
- Routing wildcard qua `proxy.ts`: root, `app.ROOT_DOMAIN` và `{slug}.ROOT_DOMAIN`.
- Email/password, Google OAuth, callback SSR, xác minh email, quên/đặt lại mật khẩu.
- Onboarding tạo tenant, membership owner, gói miễn phí, phả đồ và người gốc trong một transaction.
- Mô hình phả hệ `persons` + `unions` + `union_partners` + `parentage_links`; nhiều hôn phối và bốn loại quan hệ.
- ELK layout, SVG/D3 zoom, tìm tên không dấu, chọn nút, pan/zoom/fit, thu nhánh, giới hạn đời và optimistic `graph_version`.
- CRUD phả đồ; thêm/sửa/lưu trữ/phục hồi thành viên, upload ảnh, nhiều hôn phối, nối người có sẵn và gỡ quan hệ có kiểm tra chu trình.
- Import Excel hai bước; tham chiếu `row_id`, kiểm tra cột/ID/quan hệ/chu trình/trùng tên/hạn mức; commit nguyên transaction.
- Export XLSX, SVG, PNG và PDF từ cùng mô hình SVG.
- Public projection chỉ trả trường nhạy cảm đã được bật công khai; cây protected dùng Argon2id + cookie HttpOnly ký 12 giờ.
- CMS CRUD thật cho bài viết rich text đã sanitize, sự kiện, album ảnh/YouTube, phả ký và hộp thư liên hệ; Turnstile và rate limit cho form công khai.
- Giao diện tenant responsive, tùy chỉnh logo/banner/màu/liên hệ/SEO, sitemap, Open Graph và trạng thái xuất bản/noindex.
- Ba gói lưu trong database; PayOS tạo đơn từ giá backend, webhook xác minh chữ ký và áp dụng idempotent.
- Storage upload ticket có kiểm tra membership, trạng thái gói, MIME, kích thước và quota.
- Upload được finalize trong transaction sau khi server kiểm tra magic bytes; tệp giả MIME bị xóa.
- Mời/xóa quản trị viên theo hạn mức gói; operator quản lý khóa/mở tenant, kích hoạt/gia hạn thủ công và xem audit, không có impersonation.
- Hết hạn tự chuyển `read_only`; vẫn xem website và xuất dữ liệu, không tự xóa. Yêu cầu xóa tenant có thời gian chờ 30 ngày.
- Sentry được khởi tạo cho client, Node và Edge qua tunnel nội bộ; cookie/authorization bị loại khỏi server event.
- Migration Supabase, RLS, Storage policy, audit bất biến, cross-tenant triggers và transaction functions.
- Vitest, Playwright desktop/mobile, pgTAP RLS và GitHub Actions CI.

Chế độ không có Supabase là bản demo để duyệt giao diện và không thay thế kiểm thử tích hợp. Khi có Supabase, các màn quản trị dùng dữ liệu thật và mọi mutation đi qua RLS/RPC phía server. Chính sách pháp lý hiện là bản nháp, phải được chuyên gia Việt Nam duyệt trước public launch.

## Cấu hình Supabase

1. Tạo ba project riêng cho development, staging và production, chọn Singapore (`ap-southeast-1`).
2. Sao chép `.env.example` thành `.env.local`, điền URL, publishable key và service-role key. Service-role chỉ đặt trên Vercel/server.
3. Chạy local stack và migration:

```bash
npx supabase@3.1.0 start
npx supabase@3.1.0 db reset --local
npx supabase@3.1.0 test db
```

4. Trong Supabase Auth, bật email confirmation và Google; thêm callback `https://app.ROOT_DOMAIN/auth/callback`.
5. Dùng SMTP production (Resend) cho email xác minh/reset/invite; không dùng SMTP mặc định khi pilot.
6. Tạo ít nhất một user operator, thêm `profiles.id` vào `platform_admins`, sau đó đăng ký TOTP để đạt AAL2.

## Feature flag, PayOS, Turnstile và cron

- Giữ `PUBLIC_REGISTRATION_ENABLED=false` và `PAYMENTS_ENABLED=false` trong staging cho tới khi email, CAPTCHA và webhook đã được kiểm thử. Cờ đăng ký được kiểm tra cả ở UI lẫn API tạo tenant; đồng thời tắt “Allow new users” trong Supabase Auth nếu muốn chặn luôn việc tạo tài khoản trực tiếp. Chỉ bật từng cờ ở production sau khi đạt gate pilot.
- Điền `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`.
- Cấu hình webhook duy nhất tới `https://app.ROOT_DOMAIN/api/webhooks/payos`. `returnUrl` chỉ dùng UX, không kích hoạt gói.
- Điền cặp Turnstile site/secret key. Production không có secret sẽ từ chối contact; Supabase Auth cũng cần cấu hình CAPTCHA tương ứng.
- Tạo Vercel Cron gọi `POST https://app.ROOT_DOMAIN/api/cron/maintenance` hằng ngày với `Authorization: Bearer CRON_SECRET`. Route này chuyển gói hết hạn sang `read_only`, đối soát usage và purge tenant đã qua thời gian chờ.

## Vercel và DNS

1. Import repository vào Vercel, đặt framework Next.js và khai báo toàn bộ env riêng cho Preview/Production.
2. Preview tuyệt đối không dùng production Supabase project.
3. Thêm `ROOT_DOMAIN`, `app.ROOT_DOMAIN` và `*.ROOT_DOMAIN` vào project; cấu hình nameserver/DNS theo chỉ dẫn Vercel.
4. Đặt `ROOT_DOMAIN=example.vn`, `NEXT_PUBLIC_ROOT_URL=https://example.vn`.
5. Sau deploy, kiểm tra webhook PayOS, OAuth callback, upload, email và wildcard TLS bằng tenant staging.

## Kiểm tra trước merge

```bash
npm run typecheck
npm run lint
npm test
npm audit --audit-level=moderate
npm run build
npm run test:e2e
```

Sau khi deploy staging, chạy cổng smoke bằng `STAGING_BASE_URL=https://... npm run test:staging` (PowerShell đặt biến bằng `$env:STAGING_BASE_URL=...`). Checklist và các biến tùy chọn nằm tại [`docs/staging-acceptance.md`](docs/staging-acceptance.md).

Migration chỉ tiến về trước. Không sửa migration đã áp dụng; tạo migration bù.

## Gate vận hành trước pilot

Các bước sau cần tài khoản/hạ tầng thật nên không thể được xác nhận chỉ bằng bộ test local:

- Chạy `supabase db reset` và toàn bộ pgTAP trên project/local stack sạch; sau đó áp migration lên staging trước production.
- Kiểm thử webhook PayOS với tài khoản test/thật: sai chữ ký, callback giả, webhook lặp và thanh toán đến trễ.
- Kiểm tra Google OAuth, email xác minh/reset/invite qua Resend và Turnstile trên domain staging.
- Xác nhận wildcard DNS/TLS, quota Storage, Sentry alert và không có preview deployment nào nối production database.
- Thực hiện backup/restore drill vào staging, kiểm thử tải với cây/import 500 người và đo LCP/p95 trên hạ tầng thật.
- Được chuyên gia pháp lý Việt Nam duyệt Điều khoản, Chính sách bảo mật và Chính sách thanh toán/hoàn tiền.
- Pilot theo đợt 5 → 10 → 20 dòng họ; không mở đăng ký công khai nếu còn lỗi P0/P1.

## Cấu trúc chính

```text
src/app/                 Routes, API, marketing, dashboard, tenant site
src/components/          UI, tree explorer, import, auth và forms
src/lib/domain/          Quy tắc phả hệ, privacy, plan, subscription
src/lib/import-export/   Excel và SVG/PNG/PDF pipeline
src/lib/repository/      Repository demo/Supabase
supabase/migrations/     Schema, RLS, triggers và transaction functions
supabase/tests/          pgTAP cross-tenant/privacy tests
tests/unit/              Vitest nghiệp vụ
tests/e2e/               Playwright smoke/responsive
scripts/                 Smoke test deployment staging
```
