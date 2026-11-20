# Changelog

## [v1.0.0 / Contract v1.3 — Phase 4: "Bình minh: phát hành v1.0.0"] - 2026-11-20

### Added
- **Chế độ Benchmark (`bench_cmd`):** `node dist/bench.mjs --seed 42 --duration 30 --out bench.json` — mở cảnh 1280×720 chuẩn Đêm 1 (200 Bóng Mực `wander`, 100 đom đóm, L1–L3 sáng `fuel = 100`, camera quay tròn `r = 30 m, Y = 15 m, 15s/vòng`), 3 s khởi động + 30 s đo, xuất `bench.json` đầy đủ `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `frames`, `load_ms`, `peak_mem_mb`.
- **Soak Test (`soak_cmd`):** `node --expose-gc --max-semi-space-size=2 dist/soak.mjs --seed 7 --nights 10 --out soak.json` — chạy 10 Đêm liên tiếp trong 1 tiến trình, `crashes = 0` và `mem_end_mb <= 1.2 * mem_start_mb`.
- **Bảng Xếp Hạng cục bộ:** Lưu top 10 trên đĩa (`~/.dao-den-long-leaderboard.json`), màn hình Bảng Xếp Hạng từ Menu chính, nhập tên 3–12 ký tự sau Bình Minh hoặc khi thua, hỗ trợ `node dist/run.mjs --export-leaderboard out.json`.
- **Dễ tiếp cận (Accessibility):** Đổi toàn bộ 9 phím điều khiển (có báo trùng phím + nút Khôi phục mặc định), phụ đề & mũi tên chỉ hướng Bóng Mực vừa xuất hiện, tùy chọn Giảm chuyển động, cỡ chữ UI tối thiểu 18 px + tùy chọn Chữ lớn (×1.25).
- **Đóng gói phát hành:** `dist/run.mjs` chạy bản web tĩnh `dist/web/` + API bảng xếp hạng cục bộ; hoàn thiện `README.md`, `docs/notes/retro.md`, `bench.json`, `soak.json`, tag `phase-4` và Release `v1.0.0`.

## [v1.2 — Phase 3: "Đèn cạn dầu"] - 2026-11-20

### Breaking Changes (Thay đổi phá vỡ tương thích so với v1.1 / Phase 2)
- **Contract version:** Nâng `contract_version` từ `"1.1"` lên `"1.2"`.
- **Luật thắng `[THAY THẾ]`:** Bỏ thắng sớm `all_lit`. Thắng tại bình minh (`time_left_s <= 0`) khi Mây còn sống và số đèn sáng `>= ceil(0.6 * tổng đèn)` (`3/5`, `4/6`, `5/7`) với `reason = "dawn_survived"`.
- **Thời lượng Đêm `[THAY THẾ]`:** Đêm 1 / 2 / 3 đổi thành `240 / 270 / 300 s`.
- **Nhiên liệu đèn `[THAY THẾ]`:** Đèn sáng hao `1.0 fuel/s` (tính bằng số nguyên `1/60`), tắt khi `fuel <= 0` (`lantern_out`), cho phép châm dầu (`refuel`), thắp lại đèn đã từng sáng (`ever_lit`) chỉ tốn `5` đom đóm.
- **Vùng an toàn & Hút dầu `[THAY THẾ]`:** Đèn có `fuel < 30` mất vùng an toàn `6 m`; Bóng Mực `wander` hút `5 fuel/s` ở trạng thái `drain` (`fuel_drain` mỗi 60 tick).
- **Công thức điểm `[THAY THẾ]`:** Nạp/châm dầu `+5`/đom đóm, thắp lần đầu `+100`, thắp lại `+40`, Pulse `+5` (`+15` nếu đang `drain`), thưởng bình minh `+50 + floor(fuel)` mỗi đèn sáng + `+50` mỗi Ngọn Lửa còn lại.

### Added
- Sức chứa tăng dần `10 + 2 * successful_lights` (tối đa `20`), chế độ mù màu (`#00B3FF`, `#FFFFFF + ⚠`, đèn tắt xẹp 20% + vết rách, nhấp nháy 1 Hz `< 30` dầu), `ADR-001`.

## [v1.1 — Phase 2: "Ba hòn đảo"] - 2026-11-20
- Chuẩn hóa toàn bộ thông số gameplay theo Ticket-02, bổ sung Đêm 2 (Đảo Cau), Đêm 3 (Đảo Chuông), Lướt, Rơi khỏi đảo, Gió Lạc, Bùa Gió, Tạm dừng, Cài đặt, HUD đầy đủ và bảng màu chuẩn.

## [v1.0 — Phase 1: MVP Đêm 1] - 2026-11-20
- Bản chơi được Đêm 1 (Đảo Bến), kiến trúc tách `src/core/` và `src/render/`, chế độ headless Contract v1.0, bộ test tất định và harness AI ban đầu.
