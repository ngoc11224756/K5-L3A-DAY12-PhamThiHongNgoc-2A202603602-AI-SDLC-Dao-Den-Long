# Nhật ký dùng AI & Quản lý Token

## Phase 0 & Phase 1

### Công cụ & Harness
- **Agent:** Antigravity (Gemini)
- **Harness đã xây dựng:**
  - `AGENTS.md`: quy tắc kiến trúc tách `src/core/` và `src/render/`, đồng bộ `game.contract.json`, cấm `Math.random()` trong core, bắt buộc kiểm chứng trước khi chốt.
  - `.agents/skills/verify-phase/SKILL.md`: quy trình tự động build → test → kiểm chứng tính tất định → xuất bằng chứng.
  - `.githooks/pre-push`: hook tự động chạy `npm test` trước mỗi lần push để ngăn push khi test đỏ (bật bằng `git config core.hooksPath .githooks`).

### Ước tính Token & Cách tiết kiệm
| Phase | Lượt tương tác chính | Ước tính token (in + out) | Cách tiết kiệm đã áp dụng |
|---|---:|---:|---|
| CP0 + Phase 1 | ~8 lượt | ~42,000 tokens (~$0.05–$0.10 ước tính) | Đọc song song toàn bộ 6 file hướng dẫn trong 1 lượt; chốt toàn bộ tuning + kiến trúc trước khi code; tạo nhóm file độc lập song song; chạy `tsc`, `build`, `test`, `verify` trong 1 lệnh duy nhất |

### Lỗi / Sự cố phát hiện & Cách xử lý
1. **Chrome remote debugging chưa bật** nên không tự đọc được trang Lab board trên `claude.ai` → chuyển sang copy-paste nguyên văn PRD-0 + Test Contract v1.0 để tránh đoán/bịa yêu cầu.
2. **`npm install` bị chặn mạng trong sandbox** → chuyển chạy riêng bước `npm install` ngoài sandbox, còn toàn bộ `tsc`, `vite build`, `esbuild`, `node --test`, `verify-phase1` chạy hoàn toàn trong sandbox.
3. **Đảm bảo chạy được trên mọi bản Node (>= 18) khi giảng viên chấm:** thay vì chạy trực tiếp `.ts` bằng Node 25, bổ sung `scripts/build-headless.mjs` dùng `esbuild` (có sẵn trong Vite) biên dịch ra `dist/headless.mjs` thuần JS.
4. **GitHub PAT thiếu scope `workflow`** khiến GitHub từ chối push `.github/workflows/ci.yml` → chuyển cơ chế tự động kiểm chứng sang local git hook `.githooks/pre-push` (chạy `npm test` trước mọi lần push) để giữ quy trình tự động mà không cần cấp lại token.
