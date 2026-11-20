# ADR-001: Chuyển mô hình Đèn sang Nhiên liệu (Fuel) & Luật thắng Sống sót tới Bình minh

- **Trạng thái:** Đã áp dụng (Phase 3 · Contract v1.2 · `TICKET-03`)
- **Ngày:** 2026-11-20

## 1. Bối cảnh
Ở Phase 1–2, mỗi Đèn Lồng Lớn chỉ có trạng thái nhị phân (`lit: false -> true`) và game kết thúc thắng ngay lập tức (`all_lit`) khi đủ số đèn sáng. Playtest cho thấy người chơi giỏi thắp hết đèn chỉ trong ~2 phút, làm mất cao trào ở giai đoạn cuối Đêm.

## 2. Quyết định thiết kế

### A. Mô hình trạng thái Đèn & Độ chính xác nhiên liệu
1. **Dùng số nguyên `fuelUnits` (đơn vị `1/60` fuel):**
   - `MAX_FUEL_UNITS = 6000` (`100.0`), `LOW_FUEL_UNITS = 1800` (`30.0`), `FUEL_PER_MOTE_UNITS = 600` (`10.0`).
   - Hao hụt tự nhiên `-1` đơn vị/tick, mỗi Bóng Mực đang `drain` trừ thêm `-5` đơn vị/tick.
   - *Lý do:* Tránh hoàn toàn sai số dấu phẩy động khi cộng/trừ `1/60` và `5/60` qua hàng chục nghìn tick, đảm bảo tính tất định 100% giữa macOS và Linux; chỉ chia 60 và làm tròn 1 chữ số thập phân khi xuất snapshot/event.
2. **Máy trạng thái đèn 3 pha:**
   - `Chưa từng sáng` (`lit=false, everLit=false`, cần `10` đom đóm, `+100đ`).
   - `Đang sáng` (`lit=true`, `fuel > 0`):
     - `fuel >= 30`: có vùng an toàn `6 m`.
     - `0 < fuel < 30`: mất vùng an toàn, bị Bóng Mực `wander` chọn làm mục tiêu hút dầu (`drain`), nhấp nháy `1 Hz`.
     - Có thể châm dầu (`refuel`) khi `fuel < 100` (bỏ qua nếu đầy dầu).
   - `Đã tắt sau khi cạn dầu` (`lit=false, everLit=true`, `deposited=0`, phát `lantern_out`): thắp lại chỉ cần `5` đom đóm (`relight: true`, `+40đ`, tăng `relit_count`).

### B. Luật thắng mới (`dawn_survived`) & Thứ tự trong tick
- Loại bỏ thắng sớm `all_lit`; thời lượng 3 Đêm rút gọn còn `240 / 270 / 300 s`.
- Tại **Bước 2** của tick: trừ dầu (hao tự nhiên + Bóng Mực hút), ngay sau đó tắt các đèn `fuelUnits <= 0` (`lantern_out`) trước khi sang Bước 3.
- Tại **Bước 11** (xét thắng/thua cuối tick):
  1. `flames <= 0` → thua ngay (`no_flames`), kể cả ở tick bình minh.
  2. `timeLeftS <= 0` → nếu `litCount >= ceil(0.6 * totalLanterns)` (`3/5`, `4/6`, `5/7`) → thắng (`dawn_survived`), cộng điểm bình minh `50 + floor(fuel)` mỗi đèn sáng + `50 × flames`; ngược lại → thua (`dawn`).

## 3. Hệ quả & Cập nhật kiểm thử
- Hai test trong `tests/phase1.test.mjs` (kiểm tra contract version & luật thắng `all_lit` cũ) bị luật mới thay thế trực tiếp → đã cập nhật theo Contract v1.2 với ghi chú lý do rõ ràng, không tắt/bỏ qua âm thầm.
- Bổ sung `tests/phase3.test.mjs` kiểm chứng đầy đủ hao dầu, `lantern_out`, `relight`, `refuel`, `drain`/`fuel_drain`, thưởng Pulse `+15`, `dawn_survived` và sức chứa tăng dần `10 -> 20`.
