---
name: verify-phase
description: Build headless binary & web bundle, run regression + phase scenario tests, verify determinism (2 identical runs) and 21,600-tick performance budget, and capture real proof artifacts.
---

# Verify Phase Skill (Updated for Phase 2 / Contract v1.1)

Use this skill before tagging any phase (`phase-1` .. `phase-4`) or after any change to `src/core/`, `src/core/maps.ts`, or `game.contract.json`.

## Steps
1. Run `npx tsc --noEmit` to catch any TypeScript type errors.
2. Run `npm run build` to ensure both Vite web bundle (`dist/web/`) and headless CLI (`dist/headless.mjs`) compile cleanly.
3. Run `npm test` to execute Phase 1 regression tests (`tests/phase1.test.mjs`) and Phase 2 feature tests (`tests/phase2.test.mjs`).
4. Run `npm run verify` to generate fresh headless proof outputs into `docs/proof/phase-2/`, check SHA-256 determinism across two 21,600-tick Night 3 runs, and confirm runtime is `<= 30 s`.
5. Check `git status` and ensure no `.env`, secrets, or hand-edited proof files exist.
6. Never tag a phase if any test fails; if a requirement is incomplete, record it honestly as "chưa đạt" in the phase proof table.
