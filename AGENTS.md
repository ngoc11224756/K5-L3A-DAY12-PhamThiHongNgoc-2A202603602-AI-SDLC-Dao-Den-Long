# AGENTS.md — Đảo Đèn Lồng

## Commands
- Install: `npm install`
- Build (web + headless): `npm run build`
- Build headless only: `npm run build:headless`
- Run 3D game: `npm run dev`
- Run tests (Phase 1 regression + Phase 2 scenarios): `npm test`
- Run verification & proof capture: `npm run verify`
- Headless CLI (Contract v1.1): `node dist/headless.mjs --seed 42 --night 1 --ticks 600 --out /tmp/out.jsonl` (`--night` supports `1`, `2`, `3`)

## Architecture Rules
1. **Strict core/render split**: `src/core/` (`types.ts`, `prng.ts`, `config.ts`, `maps.ts`, `validation.ts`, `simulation.ts`) MUST have zero imports from `three`, `window`, `document`, or browser APIs. Headless and 3D render share the exact same `src/core/` simulation.
2. **Single source of truth for tuning**: `src/core/config.ts` MUST match `game.contract.json` (Contract v1.1) exactly.
3. **Strict 12-step tick order**: Always preserve the Ticket-02 tick order in `src/core/simulation.ts` (pause first → counters → player move/dash/jump/wind/fall → pickups → lantern interact → safe zones → pulse → enemy move → collisions → spawns → win/lose → snapshot).
4. **Determinism**: Never use `Math.random()` or `Date.now()` inside `src/core/`. Always use `SeededRng` (`src/core/prng.ts`).
5. **Creativity isolation**: Any visual/audio/creative additions MUST live in `src/render/` and NEVER change headless simulation state or JSONL output.

## Verification & Honesty Rules
- Never declare a phase or task done until `npx tsc --noEmit`, `npm run build`, `npm test`, and `npm run verify` pass with exit code 0.
- Full Night 3 headless run (21,600 ticks) MUST complete in `<= 30 s`.
- Never hand-edit proof outputs or write tautological tests.
- When requirements change in later phases, update or remove affected tests with an explicit written reason in `docs/notes/assumptions.md`.
