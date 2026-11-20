# Giả định & Tiêu chí nghiệm thu theo từng Phase

## Phase 1 (PRD-0 + Test Contract v1.0)
*(Đã hoàn thành tại tag `phase-1` với các giả định tự chọn trước khi chuẩn hóa ở Phase 2.)*

---

## Phase 2 (TICKET-02 "Ba hòn đảo" + Test Contract v1.1)

### 1. Thay đổi so với Phase 1 & Lý do cập nhật test cũ
Ticket-02 chuẩn hóa toàn bộ thông số gameplay và luật tính điểm để mọi bài cho cảm giác điều khiển giống nhau:
- **Thông số chuẩn thay thế giả định Phase 1:** `player_speed: 6.0`, `carry_capacity: 10`, `lantern_cost: 10`, `pickup_radius: 1.0`, `interact_radius: 2.0`, `pulse_cost: 3`, `pulse_radius: 5.0` (3D từ `player.pos + 0.8 Y`), `pulse_stun_s: 2.0` (120 tick), `pulse_push_m: 4.0` (trong 15 tick), `pulse_cooldown_s: 3.0`, `shade_speed: 4.0` (Đêm 3: `4.5`), `shade_hit_radius: 1.0`, `fall_enabled: true`, `night1/2/3_duration_s: 300/330/360`.
- **Luật tính điểm thay đổi:** `+10` mỗi đom đóm **khi nạp vào đèn** (thay vì khi nhặt ở Phase 1), `+100` mỗi đèn thắp (thay vì `+200`), `+5` mỗi Bóng Mực trúng Pulse (thay vì `+25`), `+50` mỗi Ngọn Lửa còn lại khi thắng (thay vì `+100`).
- **Cập nhật `tests/phase1.test.mjs`:** Các bài test hồi quy Phase 1 đã được cập nhật đúng theo số chuẩn Contract v1.1 và luật tính điểm mới (không tắt hay xóa test nào; toàn bộ 10 test hồi quy đều chạy xanh cùng 6 test tính năng mới Phase 2).

### 2. Giả định bổ sung cho các chi tiết nhỏ ở Phase 2
- **Tốc độ tăng tốc/dừng (`<= 0.1 s`):** Chọn tăng tốc/dừng tức thời (0 tick trễ), thỏa mãn `<= 0.1 s` và đảm bảo toán học di chuyển chính xác theo tick.
- **Vị trí tâm Bóng Mực khi sinh ngẫu nhiên:** Đặt `Y = groundY + 0.8` để khớp tâm Tỏa Sáng (`chân Mây + 0.8 m`).
- **Tọa độ xuất phát Đêm 3:** Vẫn dùng `(0, 0, 0)` trên tầng 0 theo quy ước chung; vách đứng tầng 2 chỉ chặn đi ngang từ ngoài (`r > 8`) vào nên không làm kẹt Mây.

### 3. Tiêu chí nghiệm thu (Acceptance Criteria) — Phần 3 Ticket-02
- **AC-2.1 (Gió Lạc — Drifters):** Xuất hiện ở Đêm 2 & 3 (tối đa 2 con, sinh tick `1200, 2400, ...`); chuyển `idle -> chase` khi Mây mang `>= 5` đom đóm và cách `<= 15 m`; chạm `<= 1.2 m` cướp `min(3, carried)` phát `drifter_steal` rồi `flee`; trúng Pulse lúc `chase` chuyển `flee` không cướp, trúng lúc `flee` có đồ thả lại đom đóm rơi phát `drifter_drop`.
- **AC-2.2 (Bùa Gió — Charms):** `C1` ở Đêm 2 `(35,0,0)` và `C1/C2` ở Đêm 3 `(±30,0,25)`; nhặt phát `charm_picked`, tăng tốc `7.2 m/s` và bỏ hồi chiêu Lướt trong `600` tick, hồi sinh sau `2700` tick.
- **AC-2.3 (Chuỗi 3 Đêm):** Có Menu chính (chơi chuỗi hoặc chọn Đêm) → Màn giới thiệu Đêm (tên đảo, lời Ông Đăng) → Chơi → Màn kết quả → Sang Đêm tiếp theo → Thắng Đêm 3 hiện màn hình **Bình Minh** kèm tổng điểm; thua cho chơi lại Đêm đó.
- **AC-2.4 (Tạm dừng `Esc`/`P`):** Đóng băng hoàn toàn `sim_tick`, thời gian, hồi chiêu, sinh quái và TTL; snapshot ghi `state: "paused"`, phát `paused`/`resumed`. Menu tạm dừng có đủ 4 nút: Tiếp tục, Chơi lại Đêm, Cài đặt, Về menu.
- **AC-2.5 (Cài đặt lưu bền vững):** Chỉnh âm lượng và độ nhạy chuột, lưu vào `localStorage` và giữ nguyên khi mở lại game.
- **AC-2.6 (Âm thanh):** Có nhạc nền đêm + hiệu ứng tổng hợp Web Audio cho nhặt, nạp, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, cảnh báo gió và đếm ngược 10 s cuối.
- **AC-2.7 (HUD đầy đủ):** Ngọn Lửa (trên trái), đồng hồ `mm:ss` (trên giữa, đỏ + nhấp nháy `<= 30 s`), đèn `k/n` & điểm (trên phải), thanh đom đóm 10 ô (dưới giữa), hồi chiêu Lướt & Tỏa Sáng (dưới phải), nhắc `"E — Nạp ánh sáng (x/10)"`, mũi tên ngoài màn hình chỉ tới đèn chưa sáng gần nhất.
- **AC-2.8 (Bảng màu chuẩn & Ánh sáng):** Dùng đúng bảng màu hex của Ticket-02; cường độ ánh sáng môi trường `= 0.15 + 0.55 * (đèn sáng / tổng đèn)`.
- **AC-2.9 (Hiệu năng & Tất định):** Chạy headless Đêm 3 đầy đủ `21.600` tick xong trong `<= 30 s` và 2 lần chạy cùng seed cho SHA-256 trùng khớp.
