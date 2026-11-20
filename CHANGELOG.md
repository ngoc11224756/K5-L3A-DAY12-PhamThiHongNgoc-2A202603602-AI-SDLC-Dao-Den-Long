# Changelog

## [v1.2 — Phase 3: "Đèn cạn dầu"] - 2026-11-20

### Breaking Changes (Thay đổi phá vỡ tương thích so với v1.1 / Phase 2)
- **Contract version:** Nâng `contract_version` từ `"1.1"` lên `"1.2"`.
- **Luật thắng `[THAY THẾ]`:** Bỏ thắng sớm `all_lit` khi thắp hết đèn. Thắng chỉ xảy ra tại bình minh (`time_left_s <= 0`) khi Mây còn sống và số đèn đang sáng `>= ceil(0.6 * tổng đèn)` (Đêm 1: 3/5, Đêm 2: 4/6, Đêm 3: 5/7) với `game_over.reason = "dawn_survived"`.
- **Thời lượng Đêm `[THAY THẾ]`:** Đêm 1 / 2 / 3 đổi từ `300 / 330 / 360 s` thành **`240 / 270 / 300 s`**.
- **Nhiên liệu đèn `[THAY THẾ]`:** Đèn đang sáng hao `1.0 fuel/s`, tắt khi `fuel <= 0` (`lantern_out`), cho phép châm dầu (`refuel`) khi `fuel < 100`, thắp lại đèn đã từng sáng (`ever_lit`) chỉ tốn `5` đom đóm.
- **Vùng an toàn & Hút dầu `[THAY THẾ]`:** Đèn có `fuel < 30` mất vùng an toàn `6 m`; Bóng Mực `wander` tiến tới hút `5 fuel/s` ở trạng thái mới `drain` (phát `fuel_drain` mỗi 60 tick).
- **Công thức điểm `[THAY THẾ]`:** Nạp/châm dầu `+5`/đom đóm (cũ `+10`), thắp lần đầu `+100`, thắp lại `+40`, Tỏa Sáng `+5` (`+15` nếu Bóng Mực đang `drain`), bỏ thưởng thời gian (`per_second_left: 0`), thêm thưởng bình minh `+50 + floor(fuel)` mỗi đèn sáng + `+50` mỗi Ngọn Lửa còn lại.
- **Snapshot & Events v1.2:** Đèn thêm `fuel`, `ever_lit`, `relit_count`; `player` thêm `capacity`; `lantern_lit` thêm `relight: boolean`; thêm sự kiện `refuel`, `lantern_out`, `fuel_drain`.

### Added
- **Sức chứa tăng dần:** `capacity = min(20, 10 + 2 * successful_lights)` hiển thị `đang mang / sức chứa` trên HUD.
- **Chế độ mù màu ("Bảng màu dễ phân biệt"):** Lưu trong `localStorage`; đổi viền & mắt Bóng Mực sang `#00B3FF`, cảnh báo UI sang `#FFFFFF` kèm `⚠`; đèn tắt xẹp 20% + vết rách; đèn `< 30` dầu nhấp nháy `1 Hz` kèm thanh dầu trên đèn.
- **Tài liệu:** Thêm `docs/notes/ADR-001-lantern-fuel-and-dawn-win.md` và `CHANGELOG.md`.

## [v1.1 — Phase 2: "Ba hòn đảo"] - 2026-11-20
- Chuẩn hóa toàn bộ thông số gameplay theo Ticket-02, bổ sung Đêm 2 (Đảo Cau), Đêm 3 (Đảo Chuông), Lướt, Rơi khỏi đảo, Gió Lạc, Bùa Gió, Tạm dừng, Cài đặt, HUD đầy đủ và bảng màu chuẩn.

## [v1.0 — Phase 1: MVP Đêm 1] - 2026-11-20
- Bản chơi được Đêm 1 (Đảo Bến), kiến trúc tách `src/core/` và `src/render/`, chế độ headless Contract v1.0, bộ test tất định và harness AI ban đầu.
