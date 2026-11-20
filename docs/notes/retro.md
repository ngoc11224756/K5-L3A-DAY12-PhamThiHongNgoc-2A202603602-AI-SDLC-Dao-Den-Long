# Đánh giá từng Phase & Retro

## Đánh giá Phase 1 (PRD-0 + Test Contract v1.0)
- **Kết quả đạt được:** 10/10 test pass, SHA-256 tất định khớp 100%, đã tag `phase-1` đúng hạn và chỉnh cảm giác điều khiển phím mũi tên theo phản hồi chơi thử.

## Đánh giá Phase 2 (TICKET-02 "Ba hòn đảo" + Test Contract v1.1)
- **Kết quả đạt được:**
  - Đồng bộ hoàn toàn số liệu chuẩn v1.1 (`game.contract.json` & `src/core/config.ts`) và thứ tự 12 bước trong tick.
  - Xây dựng đủ 3 bản đồ chuẩn (Đảo Bến, Đảo Cau có cầu tre & 2 bục nhảy, Đảo Chuông 3 tầng có 2 dốc, bục nhảy, tháp chuông & gió mạnh).
  - Hoàn thiện đủ tính năng mới: Lướt (Dash), rơi khỏi đảo + hồi sinh, Gió Lạc, Bùa Gió, chuỗi 3 Đêm + Bình Minh, Tạm dừng (đóng băng `sim_tick`), Cài đặt lưu `localStorage`, âm thanh tổng hợp đầy đủ, HUD 10 ô + mũi tên chỉ đèn ngoài màn hình, bảng màu chuẩn.
  - **Kiểm chứng & Hiệu năng:** 16/16 test pass (`10` hồi quy Phase 1 + `6` scenario Phase 2); chạy full Đêm 3 `21.600` tick hết **148 ms** (vượt xa yêu cầu `<= 30 s`), SHA-256 trùng khớp tuyệt đối.
- **Chỗ chưa đo tự động:** FPS trung bình 3D ở 1280×720 (`>= 30 FPS`) cần đo trực tiếp trên trình duyệt có WebGL (cấu trúc low-poly < 200 draw calls nhẹ nên đạt mượt 60 FPS trên macOS).
- **Điều cần chỉnh cho Phase 3:** Khi nhận Ticket-03 (có thể thay thế luật cũ trong 30 phút), giữ nguyên quy tắc tách `src/core/` và liệt kê ngay danh sách test bị ảnh hưởng trước khi sửa code.

## Đánh giá Phase 3 (TICKET-03 "Đèn cạn dầu" · Contract v1.2)
- **Kết quả đạt được:**
  - Triển khai trọn vẹn Change Request trong chưa đầy 10 phút: nhiên liệu đèn bằng số nguyên `1/60` (`fuelUnits`), `refuel`, `lantern_out`, thắp lại `5` đom đóm, Bóng Mực hút dầu `drain`/`fuel_drain`, thưởng Pulse `+15`, luật thắng `dawn_survived` (3/5, 4/6, 5/7), sức chứa tăng dần `10 -> 20`, chế độ mù màu lưu bền vững (`#00B3FF`, `#FFFFFF + ⚠`, đèn tắt xẹp 20% + vết rách, nhấp nháy 1 Hz).
  - Viết đầy đủ [ADR-001](ADR-001-lantern-fuel-and-dawn-win.md) và [CHANGELOG.md](../../CHANGELOG.md) liệt kê các breaking changes.
  - **Kiểm chứng:** **21/21 test pass** (10 Phase 1 cập nhật có lý do + 6 Phase 2 giữ nguyên + 5 Phase 3 mới); chạy full Đêm 3 `18.000` tick hết **207 ms**, SHA-256 khớp 100%.

---

## Retro tổng kết dự án
*(Sẽ hoàn thiện ở Checkpoint 5 sau khi kết thúc Phase 4.)*
