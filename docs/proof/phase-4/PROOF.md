# Bằng chứng kiểm chứng Phase 4 (TICKET-04 "Bình minh: phát hành v1.0.0" · Contract v1.3)

- **Cấu hình máy đo:** darwin arm64 · CPU: Apple M2 Pro · RAM: 16 GB · Node v25.9.0

## 1. Bảng truy vết Yêu cầu → Bằng chứng

| Yêu cầu (Ticket-04 / Contract v1.3) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Chế độ benchmark (`node dist/bench.mjs --seed 42 --duration 30 --out bench.json`) | Chạy thật trên Chrome 1280×720 (200 Bóng Mực + 100 đom đóm + L1–L3 sáng) | `bench.json`: avg_fps=**404.9**, p1_low_fps=**88.6**, frame_ms_p95=3.5ms, load_ms=2705ms, frames=12147 | Đạt |
| Soak test 10 Đêm liên tiếp (`crashes=0`, `mem_end_mb <= 1.2 * mem_start_mb`) | `node dist/soak.mjs --seed 7 --nights 10 --out soak.json` | `soak.json`: crashes=**0**, mem **62.5 → 74.6 MB** (0.2s) | Đạt |
| Bảng xếp hạng cục bộ (Top 10, lưu đĩa, `--export-leaderboard`) | `tests/phase4.test.mjs` + `node dist/run.mjs --export-leaderboard` | `docs/proof/phase-4/leaderboard-export.json` | Đạt |
| Dễ tiếp cận (Đổi 9 phím có báo trùng + khôi phục mặc định, phụ đề + mũi tên Bóng Mực, giảm chuyển động, chữ ≥ 18px + ×1.25) | Build `dist/web/` & kiểm tra UI | `src/main.ts`, `src/style.css`, `index.html` | Đạt |
| Hồi quy Phase 1–3 không bị thay thế | `npm test` | 23/23 test pass | Đạt |
| Đóng gói phát hành (README ≤ 3 lệnh, CHANGELOG 4 phase, CREDITS, LICENSE, Retro, Release `v1.0.0`) | Kiểm tra repo & bản đóng gói tĩnh | `dist/web/` + `dist/*.mjs` | Đạt |
