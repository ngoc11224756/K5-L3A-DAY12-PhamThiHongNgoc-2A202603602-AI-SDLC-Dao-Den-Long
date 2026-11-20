# Đánh giá từng Phase & Retro

## Đánh giá Phase 1 (PRD-0 + Test Contract v1.0)
- **Kết quả đạt được:** 10/10 tiêu chí nghiệm thu đạt (`npm test` 10/10 pass trong ~0.8s; `npm run build` sinh `dist/web/` và `dist/headless.mjs` không lỗi; `npm run verify` xác nhận SHA-256 giống hệt nhau giữa 2 lần chạy cùng seed).
- **Chỗ chưa đạt / giới hạn hiện tại:** Chưa quay video demo (sẽ làm ở Checkpoint 5 sau Phase 4 theo lịch lab); chưa kiểm thử trực tiếp trên trình duyệt từ CLI vì Chrome chưa bật remote debugging — cần người dùng mở `npm run dev` kiểm tra trực quan.
- **Hồi quy:** Không áp dụng ở Phase 1 (là baseline đầu tiên).
- **Điều cần chỉnh cho Phase 2:** Khi nhận Ticket-02, đọc kỹ mọi thay đổi ở Test Contract và cập nhật `game.contract.json` + `src/core/config.ts` trước khi viết code mới; bổ sung unit test so sánh tự động toàn bộ khóa trong `game.contract.json` với `TUNING`.

---

## Retro tổng kết dự án
*(Sẽ hoàn thiện ở Checkpoint 5 sau khi kết thúc Phase 4.)*
