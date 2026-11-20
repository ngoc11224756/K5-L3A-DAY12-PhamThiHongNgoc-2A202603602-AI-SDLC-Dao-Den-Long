# AGENTS.md — Đảo Đèn Lồng

## Commands
- Install & Build: `npm ci && npm run build`
- Run 3D game: `node dist/run.mjs` (hoặc `npm run dev` khi phát triển)
- Export leaderboard: `node dist/run.mjs --export-leaderboard out.json`
- Run all tests (Phase 1–4): `npm test`
- Run verification & soak proof: `npm run verify`
- Headless CLI (Contract v1.3): `node dist/headless.mjs --seed 42 --night 1 --ticks 600 --out /tmp/out.jsonl` (`--night` supports `1`, `2`, `3`)
- Benchmark (1280×720, 30s): `node dist/bench.mjs --seed 42 --duration 30 --out bench.json`
- Soak test (10 nights): `node --expose-gc --max-semi-space-size=2 dist/soak.mjs --seed 7 --nights 10 --out soak.json`

## Architecture Rules
1. **Strict core/render split**: `src/core/` (`types.ts`, `prng.ts`, `config.ts`, `maps.ts`, `validation.ts`, `simulation.ts`, `leaderboard.ts`) MUST have zero imports from `three`, `window`, `document`, or browser APIs.
2. **Single source of truth for tuning**: `src/core/config.ts` MUST match `game.contract.json` (Contract v1.3) exactly.
3. **Strict 12-step tick order + integer fuel**: Preserve Ticket-02/03 tick order and integer `1/60` fuel units in `src/core/simulation.ts`.
4. **Determinism**: Never use `Math.random()` or `Date.now()` inside `src/core/` simulation. Always use `SeededRng`.
5. **Creativity isolation**: Any visual/audio/creative additions MUST live in `src/render/`, NEVER change headless output, and be disabled in benchmark/soak modes.

## Verification & Honesty Rules
- Never declare a phase done until `npx tsc --noEmit`, `npm run build`, `npm test`, and `npm run verify` pass with exit code 0.
- Full Night headless run MUST finish in `<= 30 s`; Soak test MUST have `crashes = 0` and `mem_end_mb <= 1.2 * mem_start_mb`.
- Never hand-edit proof outputs, `bench.json`, or `soak.json`.
