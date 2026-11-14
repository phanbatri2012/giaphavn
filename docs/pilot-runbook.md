# Pilot runbook

## Cổng mở rộng

1. **5 tenant:** chỉ người được mời; theo dõi lỗi auth, import, cây 500 nút, upload và contact mỗi ngày.
2. **10 tenant:** chỉ mở khi không còn P0/P1, PayOS idempotency đã kiểm chứng và backup production đã restore được vào staging.
3. **20 tenant:** chỉ mở khi p75 LCP public site < 2,5 giây, mutation p95 < 500 ms (không tính upload/export), support có SLA và pháp lý đã duyệt.
4. **Public:** bật feature flag registration sau retrospective pilot; không bật custom domain, đại lý hay lịch âm tự động trước cổng này.

## Sự cố

- **Nghi rò tenant:** tắt public registration và payment, khóa tenant liên quan, giữ audit/log, kiểm tra RLS và service-role usage trước khi khôi phục.
- **Webhook lặp/trễ:** đối chiếu `payos_order_code` + `provider_reference`; không sửa subscription bằng tay trước khi xác nhận đơn.
- **Hết quota:** không xóa tệp. Chặn upload mới, cho phép export và hướng dẫn nâng gói.
- **Tenant hết hạn:** cron chuyển `read_only`; public site/export vẫn hoạt động.
- **Xóa tenant:** ghi nhận yêu cầu, đặt `purge_after = now() + 30 days`, cho phép hủy trong thời gian chờ, sau đó purge DB + Storage bằng job operator có audit.

## Restore drill

Mỗi tháng: tạo staging trống, phục hồi database backup và media metadata, đối chiếu số tenant/person/media/payment, mở ngẫu nhiên ba cây và tải một export. Ghi thời gian RPO/RTO và mọi bước thủ công còn thiếu.

