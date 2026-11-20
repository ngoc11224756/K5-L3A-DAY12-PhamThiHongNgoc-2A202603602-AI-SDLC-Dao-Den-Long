# AGENTS.md — Đảo Đèn Lồng

## Commands
- Install: `npm install`
- Build (web + headless): `npm run build`
- Build headless only: `npm run build:headless`
- Run 3D game: `npm run dev`
- Run tests: `npm test`
- Run Phase 1 verification & proof capture: `npm run verify`
- Headless CLI: `node dist/headless.mjs --seed 42 --night 1 --ticks 600 --out /tmp/out.jsonl`

## Architecture Rules
1. **Strict core/render split**: `src/core/` MUST have zero imports from `three`, `window`, `document`, or browser APIs. Headless and 3D render share the exact same `src/core/` simulation.
2. **Single source of truth for tuning**: `src/core/config.ts` MUST match `game.contract.json` exactly. A unit test enforces this.
3. **Determinism**: Never use `Math.random()` or `Date.now()` inside `src/core/`. Always use the seeded PRNG (`src/core/prng.ts`).
4. **Creativity isolation**: Any visual/audio/creative additions MUST live in `src/render/` and NEVER change headless simulation state or JSONL output.

## Verification & Honesty Rules
- Never declare a phase or task done until `npm test` and `npm run verify` pass with exit code 0.
- Never hand-edit proof outputs or write tautological tests.
- When requirements change in later phases, update or remove affected tests with an explicit written reason in `docs/notes/assumptions.md`.
