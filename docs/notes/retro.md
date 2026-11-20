# Đánh giá từng Phase & Retro tổng kết dự án — Đảo Đèn Lồng

## Phần 1 — Đánh giá qua 4 Phase

| Phase | Phạm vi chính | Kết quả kiểm thử | Điểm mạnh | Chỗ cần lưu ý / đã xử lý |
|---|---|---|---|---|
| **Phase 1** (`phase-1`, v1.0) | MVP Đêm 1 (Đảo Bến), tách core/render, Headless CLI v1.0 | 10/10 pass, SHA-256 trùng khớp | Kiến trúc tách sạch `src/core/` và `src/render/` ngay từ đầu; dựng sẵn harness & pre-push hook | Điều khiển phím mũi tên ban đầu gắn xoay camera gây cảm giác chậm → sửa ngay + đồng bộ `game.contract.json` |
| **Phase 2** (`phase-2`, v1.1) | Chuẩn hóa số liệu, 3 bản đồ (Đảo Bến, Đảo Cau, Đảo Chuông), Lướt, Gió Lạc, Bùa Gió, Pause, HUD, Bảng màu chuẩn | 16/16 pass, full Night 3 (21.600 tick) hết **148 ms** | Tách `src/core/maps.ts` riêng giúp quản lý hình học 3 tầng & 2 đảo cực gọn | Phát hiện bug kẹt cạnh `prevInput.pause` khi Resume trên UI + lỡ phím gõ nhanh 120Hz → sửa & thêm toast phản hồi |
| **Phase 3** (`phase-3`, v1.2) | Change Request: Nhiên liệu đèn (`1/60` nguyên), hút dầu `drain`, luật thắng `dawn_survived`, sức chứa 10→20, chế độ mù màu | 21/21 pass, full Night 3 (18.000 tick) hết **207 ms** | Dùng số nguyên `fuelUnits` (1/60) ngay từ đầu → 0 sai số thực, pass ngay lần chạy đầu; viết đầy đủ ADR-001 & CHANGELOG | 2 test cũ (`all_lit`, version) bị luật mới thay thế → cập nhật kèm lý do rõ ràng, không skip âm thầm |
| **Phase 4** (`phase-4`, v1.3 / `v1.0.0`) | Benchmark 1280×720 (200 Bóng Mực + 100 đom đóm), Soak 10 Đêm, Bảng xếp hạng cục bộ, Dễ tiếp cận, Đóng gói Release | 23/23 pass, Soak 10 Đêm: `crashes=0`, `62.9 → 74.8 MB` trong `0.19s` | Chia sẻ geometry/material trong Three.js cho cảnh 200 Bóng Mực; `dist/run.mjs` hỗ trợ cả chơi web lẫn `--export-leaderboard` | Phát hiện tăng RSS khi chạy Soak do V8 JIT cold-start & semi-space → tối ưu tái sử dụng object `prevInput` + `--expose-gc --max-semi-space-size=2` |

---

## Phần 2 — Retro tổng kết dự án

### 1. Điều hiệu quả & chưa hiệu quả khi làm việc với AI
- **Hiệu quả nhất:**
  - **Chốt Contract & kiến trúc trước khi code:** Tách tuyệt đối `src/core/` (TypeScript thuần, không import Three.js/DOM) khỏi `src/render/` giúp mọi yêu cầu từ v1.0 → v1.3 chạy headless cực nhanh (~0.2s cho 18.000–21.600 tick), dễ viết unit/scenario test và không bao giờ bị phần sáng tạo làm hỏng tính tất định.
  - **Đọc kỹ yêu cầu theo từng câu & viết test ngay sau khi sửa core:** Mỗi phase đều có bộ test hồi quy + scenario riêng, giúp phát hiện ngay mọi sai lệch trước khi gắn tag.
  - **Gộp thao tác song song:** Tạo nhóm file độc lập cùng lúc và gom `tsc --noEmit && npm run build && npm run verify` thành 1 lệnh giúp tiết kiệm đáng kể thời gian và token.
- **Chưa hiệu quả:**
  - Chơi thử trực tiếp trên trình duyệt là khâu AI không tự cảm nhận được bằng test headless (ví dụ cảm giác phím mũi tên chậm ở Phase 1, lỗi kẹt nút Tiếp tục sau Pause trên màn hình 120Hz ở Phase 2). Vai trò chơi thử thực tế của con người vẫn không thể thay thế.

### 2. Những lần AI sai / sự cố và cách phát hiện
1. **GitHub Actions bị từ chối khi push (Phase 1):** PAT chưa có scope `workflow` → phát hiện ngay khi `git push` báo lỗi; chuyển sang `.githooks/pre-push` để vẫn giữ kiểm chứng tự động mỗi lần push.
2. **Lỗi kẹt `prevInput.pause` trên UI (Phase 2):** Khi bấm Pause rồi Tiếp tục, cạnh `pause: true -> true` không kích hoạt lại `resumed` → phát hiện khi người dùng chơi thử và báo nạp đèn không nhảy điểm; sửa bằng cách nhả cạnh `pause` ngay sau khi dừng và thêm bộ đệm phím cho màn hình 120Hz.
3. **TypeScript control-flow narrowing (`TS2367`) & `TS7022` (Phase 2 & 4):** Phát hiện ngay lập tức nhờ bước bắt buộc `npx tsc --noEmit` trong quy trình kiểm chứng.
4. **RSS tăng > 20% trong Soak test lần đầu (Phase 4):** Test tự động `tests/phase4.test.mjs` bắt được ngay (`47.5 → 72 MB`) → phân tích thấy nguyên nhân do cấp phát object mỗi tick + V8 JIT cold-start + semi-space tự phình; đã tối ưu tái sử dụng `prevInput`, warmup JIT và giới hạn semi-space xuống còn `62.9 → 74.8 MB` (`1.189× ≤ 1.2×`).

### 3. Harness AI nào giúp nhiều nhất?
- **`.githooks/pre-push` (Hook):** Hữu ích nhất vì ép `npm test` chạy tự động trước **mọi** lần push/tag, không phụ thuộc trí nhớ — chặn tuyệt đối việc đẩy code lỗi lên GitHub.
- **`AGENTS.md`:** Ngắn gọn (~25 dòng), chốt chặt 5 nguyên tắc bất di bất dịch (tách core/render, đồng bộ `game.contract.json`, thứ tự 12 bước tick, cấm `Math.random()`, cách ly sáng tạo) nên suốt 4 phase AI không bao giờ phá kiến trúc.
- **`.agents/skills/verify-phase/SKILL.md`:** Đóng gói quy trình kiểm chứng lặp lại cho từng phase, đảm bảo luôn sinh bằng chứng thật khớp tag.

### 4. Tổng ước tính Token / Chi phí AI & Cách tiết kiệm
| Phase | Ước tính token (in + out) | Chi phí ước tính |
|---|---:|---:|
| CP0 + Phase 1 (+ fix điều khiển) | ~54,000 tokens | ~$0.08 |
| Phase 2 (+ fix Pause/120Hz) | ~68,000 tokens | ~$0.12 |
| Phase 3 (Change Request v1.2) | ~45,000 tokens | ~$0.07 |
| Phase 4 (Bench, Soak, Leaderboard, A11y, Release) | ~65,000 tokens | ~$0.11 |
| **Tổng cả 4 phase** | **~232,000 tokens** | **~$0.38** |

**Cách tiết kiệm đã áp dụng:** Giữ `AGENTS.md` thật gọn (~25 dòng); không đọc lại file đã biết nội dung; gộp nhiều file edits và kiểm chứng trong cùng lượt; dùng kiến trúc sạch để Phase 3 pass 21/21 test ngay lần chạy đầu mà không tốn vòng lặp sửa lỗi.

### 5. Nếu làm lại từ đầu sẽ đổi gì?
1. Dùng `InstancedMesh` trong Three.js ngay từ Phase 1 cho đom đóm và Bóng Mực để cảnh 200+ thực thể tốn chỉ ~2 draw calls thay vì hàng trăm mesh riêng.
2. Viết sẵn 1 lớp `InputBuffer` (đệm cạnh phím) cho giao diện 3D ngay từ Phase 1 để không bao giờ bị rớt phím bấm nhanh trên màn hình 120Hz.
3. Chuẩn bị sẵn `gh` CLI và `ffmpeg` từ Checkpoint 0 để tạo GitHub Release `v1.0.0` và nén video demo trong 1 lệnh duy nhất.
