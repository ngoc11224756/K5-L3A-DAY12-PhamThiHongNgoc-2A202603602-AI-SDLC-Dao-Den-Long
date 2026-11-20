# Đảo Đèn Lồng — Ba Hòn Đảo (Phase 3 · Contract v1.2)

> **Video demo:** *(Sẽ cập nhật link Release `v1.0.0` / `docs/demo/demo.mp4` ở Phase 4)*
> **Học viên:** Phạm Thị Hồng Ngọc · **MSSV:** `2A202603602` · **Lớp:** K5-L3A · **Lab:** Day 12 AI SDLC

Game 3D góc nhìn thứ ba qua **3 Đêm (Đảo Bến · Đảo Cau · Đảo Chuông)**. Người chơi điều khiển **Mây** gom **đom đóm**, dùng **Lướt**, **Tỏa Sáng**, **Bùa Gió** và **Bục Nhảy** để vượt qua **Bóng Mực**, **Gió Lạc** và **Gió Mạnh**, thắp sáng toàn bộ Đèn Lồng Lớn để đón Bình Minh.

---

## 1. Cài đặt và chạy (3 lệnh)

Yêu cầu: **Node.js >= 18** (chạy tốt trên macOS và Linux).

```bash
npm ci
npm run build
npm run dev
```

Mở trình duyệt tại `http://localhost:5173` để chơi từ Menu chính (chọn hành trình 3 Đêm hoặc chọn từng Đêm 1 / 2 / 3).

---

## 2. Điều khiển

| Phím / Thao tác | Chức năng |
|---|---|
| `W / A / S / D` hoặc `↑ / ↓ / ← / →` | Di chuyển theo hướng camera (`6.0 m/s`, có Bùa Gió `7.2 m/s`) |
| **Kéo chuột ngang** hoặc `Z / C` | Xoay camera quanh Mây (độ nhạy chỉnh trong Cài đặt) |
| `Space` | Nhảy (`7.0 m/s`) |
| `Shift` | **Lướt (Dash)** — `14 m/s` trong `0.2 s`, hồi chiêu `1.5 s` (không hồi chiêu khi có Bùa Gió) |
| `E` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (trong `2.0 m`, cần `10` đom đóm để thắp) |
| `Q` hoặc `F` | **Tỏa Sáng (Pulse)** — tốn `3` đom đóm, bán kính 3D `5 m`, choáng `2 s` & đẩy lùi `4 m`, hồi chiêu `3 s` |
| `Esc` hoặc `P` | Tạm dừng (đóng băng logic, mở menu Tiếp tục / Chơi lại / Cài đặt / Về menu) |

---

## 3. Cách tính điểm & Thông số chuẩn (`game.contract.json` v1.1)

| Sự kiện | Điểm |
|---|---:|
| Nạp mỗi đom đóm vào đèn (`per_mote`) | `+10` |
| Thắp sáng 1 Đèn Lồng Lớn (`per_lantern`) | `+100` |
| Mỗi Bóng Mực trúng Tỏa Sáng (`per_stun`) | `+5` |
| Thưởng thời gian còn lại khi thắng (`per_second_left`) | `+2 × floor(giây còn lại)` |
| Thưởng Ngọn Lửa còn lại khi thắng (`per_flame_left`) | `+50 × Ngọn Lửa còn lại` |

---

## 4. Kiểm thử & Chế độ Headless (Test Contract v1.1)

```bash
npm test      # Chạy 16 test (10 hồi quy Phase 1 + 6 scenario Phase 2)
npm run verify # Chạy test + benchmark 21.600 tick + kiểm tra tất định SHA-256
```

Chạy CLI headless trực tiếp cho Đêm `1`, `2`, hoặc `3`:

```bash
node dist/headless.mjs --seed 42 --night 3 --ticks 21600 --out /tmp/out.jsonl
```

---

## 5. Sáng tạo của tôi

Mọi phần sáng tạo chỉ nằm trong `src/render/`, **tách hoàn toàn khỏi `src/core/`** để không làm đổi đầu ra headless:
1. **Nhân vật Mây mang bản sắc Việt:** Áo `#E8E2D0`, khăn đỏ `#C8102E`, đội **nón lá** treo đèn lồng nhỏ và các đom đóm đang mang **bay xoay quanh người**.
2. **Đèn trời bay lên bầu trời sao:** Mỗi khi thắp sáng một Đèn Lồng Lớn, hai chiếc đèn trời ấm áp bay lên giữa bầu trời đêm.
3. **Âm thanh tổng hợp Web Audio hoàn toàn bằng code:** Nhạc nền đêm ngũ cung kết hợp đủ bộ hiệu ứng cho mọi hành động, cảnh báo gió và đếm ngược 10 s cuối (không cần file âm thanh ngoài).

---

## 6. Tài liệu & Bằng chứng SDLC

- **Harness AI:** [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md), [.githooks/pre-push](.githooks/pre-push)
- **Giả định & Acceptance Criteria:** [docs/notes/assumptions.md](docs/notes/assumptions.md)
- **Nhật ký dùng AI & Token:** [docs/notes/ai-log.md](docs/notes/ai-log.md)
- **Đánh giá & Retro:** [docs/notes/retro.md](docs/notes/retro.md)
- **Bằng chứng Phase 1:** [docs/proof/phase-1/PROOF.md](docs/proof/phase-1/PROOF.md)
- **Bằng chứng Phase 2:** [docs/proof/phase-2/PROOF.md](docs/proof/phase-2/PROOF.md)
- **Bằng chứng Phase 3:** [docs/proof/phase-3/PROOF.md](docs/proof/phase-3/PROOF.md)
- **ADR & Breaking Changes:** [docs/notes/ADR-001-lantern-fuel-and-dawn-win.md](docs/notes/ADR-001-lantern-fuel-and-dawn-win.md), [CHANGELOG.md](CHANGELOG.md)
- **Bản quyền & Nguồn:** [CREDITS.md](CREDITS.md), [LICENSE](LICENSE)
