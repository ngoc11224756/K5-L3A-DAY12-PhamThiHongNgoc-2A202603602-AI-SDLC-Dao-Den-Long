# Nhật ký dùng AI & Quản lý Token

## Tổng hợp Token & Cách tiết kiệm
| Phase | Lượt tương tác chính | Ước tính token (in + out) | Cách tiết kiệm đã áp dụng |
|---|---:|---:|---|
| CP0 + Phase 1 | ~8 lượt | ~42,000 tokens (~$0.05–$0.10) | Đọc song song 6 file hướng dẫn; chốt Contract v1.0 trước khi code; gộp tạo file song song |
| Phase 1 fix (điều khiển) | ~3 lượt | ~12,000 tokens (~$0.02) | Sửa trúng đích `src/main.ts`, `config.ts`, `game.contract.json` và chạy 1 lệnh kiểm chứng |
| Phase 2 (Ticket-02) | ~6 lượt | ~58,000 tokens (~$0.08–$0.15) | Tách riêng `src/core/maps.ts` cho 3 bản đồ chuẩn; viết song song core + render + 16 test + script verify |
| Phase 2 fix (Pause/120Hz) | ~2 lượt | ~10,000 tokens (~$0.02) | Sửa đúng chỗ kẹt `prevInput.pause` và thêm đệm phím bấm nhanh ở `src/main.ts` |
| Phase 3 (Ticket-03) | ~4 lượt | ~45,000 tokens (~$0.06–$0.12) | Dùng số nguyên `fuelUnits` (1/60) ngay từ đầu nên 21/21 test pass ngay lần chạy đầu, không tốn vòng lặp debug |
| Phase 4 (Ticket-04) | ~5 lượt | ~65,000 tokens (~$0.09–$0.14) | Gom xây 4 CLI (`headless`, `soak`, `bench`, `run`) vào 1 script esbuild; chia sẻ geometry/material Three.js để đạt FPS cao ở cảnh 200 Bóng Mực |

## Harness AI đã dùng & cập nhật
- `AGENTS.md`: tạo ở CP0, cập nhật ở Phase 2 để bổ sung Contract v1.1, thứ tự 12 bước trong tick, và ngưỡng hiệu năng `21.600` tick `<= 30 s`.
- `.agents/skills/verify-phase/SKILL.md`: tạo ở CP0, cập nhật ở Phase 2 cho bộ test hồi quy + Phase 2 + benchmark 21.600 tick.
- `.githooks/pre-push`: tự động chạy `npm test` (16/16 test) trước mọi lần `git push`.

## Lỗi của AI / Sự cố phát hiện & Cách xử lý
1. **Phase 1 — Chrome remote debugging chưa bật:** Chuyển sang copy-paste nguyên văn PRD-0/Ticket-02 để không đoán yêu cầu.
2. **Phase 1 — GitHub PAT thiếu scope `workflow`:** Chuyển CI từ `.github/workflows/ci.yml` sang local git hook `.githooks/pre-push`.
3. **Phase 2 — TypeScript control-flow narrowing ở `src/headless/cli.ts`:** TS báo lỗi `TS2367` khi kiểm tra `sim.state === 'won'` sau khi gọi `sim.step()` (vì TS không suy luận mutation qua method). Đã xử lý gọn và chạy lại `tsc --noEmit` đạt 0 lỗi.
4. **Phase 2 — Chênh lệch tâm 3D của Pulse (`player.y + 0.8`):** Phát hiện sớm khi thiết kế nếu Bóng Mực sinh ở `Y = 0` thì khoảng cách 3D tới tâm `0.8` sẽ bị lệch `sqrt(5^2 + 0.8^2) > 5.0`, nên đặt tâm Bóng Mực sinh tại `groundY + 0.8` đúng chuẩn Contract v1.0/v1.1.
