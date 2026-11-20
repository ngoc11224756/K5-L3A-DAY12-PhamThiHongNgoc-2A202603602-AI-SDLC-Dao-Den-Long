# Đảo Đèn Lồng (Lantern Island)

> **Video demo:** *(Sẽ cập nhật link Release `v1.0.0` / `docs/demo/demo.mp4` ở Phase 4)*
> **Học viên:** Phạm Thị Hồng Ngọc · **MSSV:** `2A202603602` · **Lớp:** K5-L3A · **Lab:** Day 12 AI SDLC

Game 3D góc nhìn thứ ba xây dựng theo quy trình AI SDLC qua 4 phase. Người chơi điều khiển **Mây**, người giữ đèn nhỏ tuổi đội nón lá treo đèn lồng, gom **đom đóm** trên **Đảo Bến** để thắp sáng **5 Đèn Lồng Lớn** và dùng ánh sáng xua đuổi **Bóng Mực** trong sương đen.

---

## 1. Cài đặt và chạy (3 lệnh)

Yêu cầu: **Node.js >= 18** (chạy tốt trên macOS và Linux).

```bash
npm ci
npm run build
npm run dev
```

Mở trình duyệt tại địa chỉ Vite hiển thị (mặc định `http://localhost:5173`) để chơi **Đêm 1 – Đảo Bến**.

---

## 2. Điều khiển

| Phím / Thao tác | Chức năng |
|---|---|
| `W / A / S / D` | Di chuyển theo hướng camera |
| `← / →` hoặc **kéo chuột ngang** | Xoay camera quanh Mây |
| `Space` | Nhảy |
| `E` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (trong `3.5 m`) |
| `Q` hoặc `F` | **Tỏa sáng (Pulse)** — tốn `1` đom đóm, làm choáng & đẩy lùi Bóng Mực trong `8.0 m` |
| `M` | Bật / tắt âm thanh tổng hợp |

---

## 3. Cách tính điểm & Thông số (`game.contract.json`)

Toàn bộ thông số gameplay được đồng bộ giữa `game.contract.json` và `src/core/config.ts`:

| Sự kiện | Điểm | Chi tiết |
|---|---:|---|
| Nhặt 1 đom đóm (`per_mote`) | `+10` | Tự nhặt trong bán kính `2.0 m`, mang tối đa `5` |
| Thắp sáng 1 Đèn Lồng Lớn (`per_lantern`) | `+200` | Cần nạp đủ `4` đom đóm; tạo vùng an toàn bán kính `6.0 m` |
| Làm choáng 1 Bóng Mực (`per_stun`) | `+25` | Mỗi Bóng Mực trúng Pulse bị choáng `3.0 s` & đẩy lùi `6.0 m` |
| Thưởng thời gian còn lại khi thắng (`per_second_left`) | `+2 / giây` | Tính theo `Math.floor(time_left_s) * 2` |
| Thưởng ngọn lửa còn lại khi thắng (`per_flame_left`) | `+100 / lửa` | Khởi đầu `3` ngọn lửa; bị chạm mất 1 lửa, rơi `round(carried * 0.5)` đom đóm, bất tử `1.5 s` |

*Lưu ý:* `fall_enabled: false` — Mây được chặn an toàn ở mép Đảo Bến (bán kính `45 m`).

---

## 4. Kiểm thử & Chế độ Headless (Test Contract v1.0)

Chạy toàn bộ unit test, scenario test và kiểm tra tính tất định:

```bash
npm test
```

Chạy kiểm chứng và sinh bằng chứng Phase 1 (`docs/proof/phase-1/`):

```bash
npm run verify
```

Chạy trực tiếp CLI headless theo **Test Contract v1.0**:

```bash
node dist/headless.mjs --seed 42 --night 1 --ticks 600 --out /tmp/out.jsonl
```

Hỗ trợ đầy đủ `--scenario <file.json>`, `--inputs <file.json>`, `--snapshot-every <int>` (mặc định `10`).

---

## 5. Sáng tạo của tôi

Mọi phần sáng tạo chỉ nằm ở lớp hiển thị & âm thanh (`src/render/`), **tách biệt hoàn toàn khỏi `src/core/`**, đảm bảo không làm thay đổi bất kỳ byte nào của đầu ra headless:

1. **Nhân vật Mây mang bản sắc Việt:** Mây đội **nón lá** có treo đèn lồng nhỏ phát sáng ấm, kèm các đom đóm đang mang **bay xoay quanh người** theo đúng số lượng `carried`.
2. **Đảo thức giấc theo ánh sáng:** Mỗi khi một Đèn Lồng Lớn được thắp, sương tím đen tan dần, ánh sáng môi trường ấm lên, hiện vòng bảo vệ `safe_radius` trên mặt đất và thả **đèn trời (sky lanterns)** bay lên bầu trời sao.
3. **Âm thanh tổng hợp Web Audio (không cần file ngoài):** Nhặt đom đóm phát chuỗi nốt ngũ cung (pentatonic), thắp đèn phát hợp âm ấm áp, tỏa sáng có hiệu ứng sóng âm + vòng ánh sáng lan tỏa.

*Bằng chứng phần lõi không bị ảnh hưởng:* `npm test` và `npm run verify` kiểm tra tính tất định SHA-256 trên `dist/headless.mjs` (không import `src/render/`).

---

## 6. Tài liệu & Bằng chứng SDLC

- **Harness AI:** [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md), [.githooks/pre-push](.githooks/pre-push)
- **Giả định & Tiêu chí nghiệm thu:** [docs/notes/assumptions.md](docs/notes/assumptions.md)
- **Nhật ký dùng AI & Token:** [docs/notes/ai-log.md](docs/notes/ai-log.md)
- **Đánh giá & Retro:** [docs/notes/retro.md](docs/notes/retro.md)
- **Bằng chứng Phase 1:** [docs/proof/phase-1/PROOF.md](docs/proof/phase-1/PROOF.md)
- **Bản quyền & Nguồn:** [CREDITS.md](CREDITS.md), [LICENSE](LICENSE)
