# Giả định & Tiêu chí nghiệm thu theo từng Phase

## Phase 1 (PRD-0 + Test Contract v1.0)

### 1. Giả định cho các chỗ mơ hồ trong PRD-0
| Mục mơ hồ | Giả định đã chọn | Lý do |
|---|---|---|
| Kích thước Đảo Bến | Hình tròn bán kính `45 m`, tâm `(0, 0, 0)`, mặt đất `Y = 0` | Đủ rộng để di chuyển, né Bóng Mực và đặt 5 Đèn Lồng Lớn cân đối |
| Vị trí 5 Đèn Lồng Lớn (`L1..L5`) | Đặt đều trên vòng tròn bán kính `26 m`, góc cách nhau `72°` | Người chơi dễ quan sát từ tâm đảo và lập tuyến đi gom đom đóm |
| Rơi khỏi đảo (`fall_enabled`) | `false` — nhân vật được chặn tại mép đảo (bán kính `45 m`) | Tránh phạt rơi không rõ ràng ở Phase 1, khớp tùy chọn `fall_enabled: false` của Contract v1.0 |
| Số đom đóm rơi khi bị Bóng Mực chạm | `dropped = Math.min(carried, Math.round(carried * hit_drop_ratio))` với `hit_drop_ratio = 0.5` | Khi đang giữ `>= 1` đom đóm sẽ luôn rơi ít nhất 1; dễ kiểm chứng và dự đoán |
| Vùng an toàn quanh đèn (`safe_radius = 6.0 m`) | Áp dụng cho các Đèn Lồng Lớn **đã thắp** (`lit: true`). Bóng Mực bị đẩy ra ngoài bán kính `6.0 m` | Khớp mô tả "Bóng Mực sợ những chiếc đèn" và tạo giá trị chiến thuật khi thắp đèn |
| Tỏa sáng (Pulse) | Tốn `1` đom đóm đang mang (`pulse_cost = 1`), làm choáng Bóng Mực trong `8.0 m` suốt `3.0 s`, đẩy lùi `6.0 m` ra xa Mây, hồi chiêu `2.0 s` | Cân bằng giữa phòng thủ và tài nguyên nạp đèn |
| Nhảy (Jump) | Vận tốc đầu `8.0 m/s`, trọng lực `-20.0 m/s²`, chạm đất tại `Y = 0` | Cảm giác nhảy gọn, tất định ở 60 Hz; khoảng cách tương tác vẫn đo theo mặt phẳng XZ theo Contract |
| Sinh ngẫu nhiên (khi `random_motes/random_shades` = `true`) | Dùng PRNG Mulberry32 theo `--seed`. Khởi đầu 18 đom đóm (tái sinh mỗi 3s nếu < 18) và 2 Bóng Mực (sinh thêm mỗi 45s, tối đa 5) | Đảm bảo 100% tất định cùng seed |
| Tính điểm cuối màn khi thắng | Cộng thưởng `Math.floor(time_left_s) * 2 + flames * 100` | Khuyến khích thắp đèn nhanh và giữ máu |

### 2. Tiêu chí nghiệm thu (Acceptance Criteria) — Phase 1
- **AC-1.1 (Di chuyển & Nhảy):** Giữ `move` theo `cam_yaw_deg` dịch chuyển đúng công thức xoay `x' = x cosθ + z sinθ, z' = -x sinθ + z cosθ`, chuẩn hóa khi độ dài > 1; bấm `jump` tạo quỹ đạo Y > 0 rồi rơi về 0.
- **AC-1.2 (Nhặt đom đóm):** Đi vào bán kính `<= 2.0 m` quanh đom đóm khi `carried < 5` → tăng `carried`, cộng `+10` điểm, phát sự kiện `mote_picked`. Không nhặt vượt `carry_capacity = 5`.
- **AC-1.3 (Nạp & Thắp đèn):** Bấm `interact` trong bán kính `<= 3.5 m` của đèn chưa thắp khi `carried > 0` → phát `deposit`; khi `deposited >= 4` → `lit = true`, cộng `+200` điểm, phát `lantern_lit`.
- **AC-1.4 (Thắng màn):** Khi cả 5 đèn đều `lit = true` → cộng thưởng thời gian & máu còn lại, `state = "won"`, phát `game_over` (`result: "won", reason: "all_lit"`), dừng ngay mô phỏng.
- **AC-1.5 (Bóng Mực đuổi & gây sát thương):** Bóng Mực đuổi Mây với tốc độ `4.2 m/s`, vào `<= 1.2 m` trừ 1 máu, đánh rơi đom đóm theo `hit_drop_ratio`, bất tử `1.5 s`, phát `player_hit`. Khi `flames === 0` → `state = "lost"`, phát `game_over` (`reason: "no_flames"`).
- **AC-1.6 (Vùng an toàn quanh đèn đã thắp):** Bóng Mực không đi vào `<= 6.0 m` của bất kỳ đèn nào đã thắp.
- **AC-1.7 (Tỏa sáng — Pulse):** Bấm `pulse` khi `carried >= 1` và hết hồi chiêu → trừ 1 đom đóm, làm choáng (`state: "stunned"`) và đẩy lùi `6.0 m` mọi Bóng Mực trong `<= 8.0 m`, cộng `+25` điểm/con, phát `pulse`.
- **AC-1.8 (Hết giờ — Dawn):** Khi `time_left_s <= 0` mà chưa thắng → `state = "lost"`, phát `game_over` (`reason: "dawn"`).
- **AC-1.9 (Headless Contract & Tất định):** Chạy 2 lần cùng `--seed`, `--scenario`, `--inputs` cho output JSONL giống nhau từng byte (SHA-256 trùng khớp). File sai định dạng trả exit code `2`.
- **AC-1.10 (Chơi 3D & Chơi lại):** Mở giao diện 3D chơi được Đêm 1, hiển thị HUD rõ ràng, thắng/thua có nút chơi lại.
