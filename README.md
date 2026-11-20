# Đảo Đèn Lồng (Lantern Island) — v1.0.0

> **Video demo:** *(Đính kèm trên [GitHub Release v1.0.0](https://github.com/ngoc11224756/K5-L3A-DAY12-PhamThiHongNgoc-2A202603602-AI-SDLC-Dao-Den-Long/releases/tag/v1.0.0) hoặc `docs/demo/demo.mp4`)*
> **Học viên:** Phạm Thị Hồng Ngọc · **MSSV:** `2A202603602` · **Lớp:** K5-L3A · **Contract:** `v1.3`

Game 3D góc nhìn thứ ba qua **3 Đêm (Đảo Bến · Đảo Cau · Đảo Chuông)**. Người chơi điều khiển **Mây** gom **đom đóm**, thắp sáng và châm dầu cho các **Đèn Lồng Lớn**, vượt qua **Bóng Mực** hút dầu, **Gió Lạc** cướp ánh sáng và **Gió Mạnh** để giữ đảo sáng tới Bình Minh.

---

## 1. Yêu cầu hệ thống & Cài đặt (3 lệnh)

- **Hệ điều hành:** macOS hoặc Linux
- **Runtime:** Node.js >= 18, trình duyệt hỗ trợ WebGL2 (Chrome/Chromium dùng cho chế độ Benchmark)

```bash
npm ci
npm run build
node dist/run.mjs
```

Trình duyệt sẽ tự mở game tại `http://127.0.0.1:5173` (có đầy đủ Menu chính, 3 Đêm, Bảng Xếp Hạng cục bộ và Cài đặt Dễ tiếp cận).

---

## 2. Điều khiển (Có thể đổi toàn bộ 9 phím trong Cài đặt)

| Phím mặc định | Chức năng |
|---|---|
| `W / A / S / D` hoặc `↑ / ↓ / ← / →` | Di chuyển (`6.0 m/s`, có Bùa Gió `7.2 m/s`) |
| **Kéo chuột ngang** hoặc `Z / C` | Xoay camera quanh Mây |
| `Space` | Nhảy (`7.0 m/s`) |
| `Shift` | **Lướt (Dash)** — `14 m/s` trong `0.2 s`, hồi chiêu `1.5 s` (0 hồi chiêu khi có Bùa Gió) |
| `E` | Tương tác: nạp đom đóm thắp đèn (`10` lần đầu / `5` thắp lại) hoặc **châm dầu** đèn đang sáng |
| `Q` hoặc `F` | **Tỏa Sáng (Pulse)** — tốn `3` đom đóm, bán kính 3D `5 m`, choáng `2 s` & đẩy lùi `4 m` |
| `Esc` hoặc `P` | Tạm dừng (đóng băng toàn bộ logic, mở menu Tiếp tục / Chơi lại / Cài đặt / Về menu) |

---

## 3. Kiểm thử, Headless, Benchmark, Soak & Bảng Xếp Hạng (Contract v1.3)

| Chức năng | Lệnh chạy |
|---|---|
| Chạy toàn bộ 23 test (Phase 1–4) | `npm test` |
| Chạy Headless CLI (Đêm `1`, `2`, `3`) | `node dist/headless.mjs --seed 42 --night 1 --ticks 600 --out /tmp/out.jsonl` |
| Chạy Benchmark 3D 1280×720 (30 s) | `node dist/bench.mjs --seed 42 --duration 30 --out bench.json` |
| Chạy Soak Test (10 Đêm liên tiếp) | `node --expose-gc --max-semi-space-size=2 dist/soak.mjs --seed 7 --nights 10 --out soak.json` |
| Xuất Bảng Xếp Hạng cục bộ | `node dist/run.mjs --export-leaderboard out.json` |

*Lưu ý về VSync trong Benchmark:* `dist/bench.mjs` khởi chạy Chrome ở cửa sổ `1280×720` kèm cờ `--disable-gpu-vsync --disable-frame-rate-limit` (trên macOS/Linux có thể vẫn chịu giới hạn trình tổng hợp màn hình ở 60/120 Hz tùy phần cứng).

---

## 4. Tính năng Dễ tiếp cận (Accessibility)

- **Đổi phím điều khiển:** Hỗ trợ đổi toàn bộ 9 hành động, tự phát hiện trùng phím và có nút *Khôi phục mặc định* (lưu `localStorage`).
- **Chế độ mù màu ("Bảng màu dễ phân biệt"):** Đổi viền & mắt Bóng Mực sang `#00B3FF`, cảnh báo UI sang `#FFFFFF` kèm `⚠`; đèn tắt phân biệt bằng hình dạng (xẹp 20% + vệt rách giấy); đèn `< 30` dầu nhấp nháy `1 Hz`.
- **Phụ đề & chỉ báo hình ảnh:** Hiện phụ đề cho Bóng Mực xuất hiện (kèm mũi tên đỏ/xanh chỉ hướng ở mép màn hình), gió sắp thổi, 10 s cuối, và đèn sắp hết dầu.
- **Giảm chuyển động & Cỡ chữ:** Tùy chọn tắt rung/chớp; cỡ chữ cơ bản `>= 18 px` ở `1280×720` và tùy chọn **Chữ lớn (×1.25)**.

---

## 5. Sáng tạo của tôi

Mọi phần sáng tạo chỉ nằm trong `src/render/`, **tách tuyệt đối khỏi `src/core/`** và **tự động tắt trong Benchmark/Soak** để không ảnh hưởng đầu ra headless hay số đo:
1. **Nhân vật Mây mang bản sắc Việt:** Áo `#E8E2D0`, khăn đỏ `#C8102E`, đội **nón lá** treo đèn lồng nhỏ và các đom đóm đang mang **bay xoay quanh người** theo sức chứa động (10 → 20).
2. **Đèn trời bay lên bầu trời sao:** Mỗi lần thắp sáng Đèn Lồng Lớn, hai chiếc đèn trời ấm áp bay lên trời đêm.
3. **Âm thanh tổng hợp Web Audio:** Nhạc nền đêm ngũ cung kết hợp đủ bộ hiệu ứng cho mọi hành động, cảnh báo gió và đếm ngược 10 s cuối (không cần file âm thanh ngoài).

---

## 6. Tài liệu, Bằng chứng & Harness AI

- **Harness AI:** [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md), [.githooks/pre-push](.githooks/pre-push)
- **Số đo thật:** [bench.json](bench.json), [soak.json](soak.json)
- **Bằng chứng 4 Phase:** [Phase 1](docs/proof/phase-1/PROOF.md) · [Phase 2](docs/proof/phase-2/PROOF.md) · [Phase 3](docs/proof/phase-3/PROOF.md) · [Phase 4](docs/proof/phase-4/PROOF.md)
- **Ghi chép SDLC:** [Giả định & AC](docs/notes/assumptions.md) · [ADR-001](docs/notes/ADR-001-lantern-fuel-and-dawn-win.md) · [Nhật ký AI & Token](docs/notes/ai-log.md) · [Retro tổng kết](docs/notes/retro.md)
- **Phát hành & Bản quyền:** [CHANGELOG.md](CHANGELOG.md), [CREDITS.md](CREDITS.md), [LICENSE](LICENSE)
