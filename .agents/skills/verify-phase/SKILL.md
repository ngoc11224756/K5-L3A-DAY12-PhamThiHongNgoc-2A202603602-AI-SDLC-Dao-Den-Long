---
name: verify-phase
description: Build headless binary, run unit + scenario tests, verify determinism (2 identical runs), and capture real proof artifacts for the current phase.
---

# Verify Phase Skill

Use this skill before tagging any phase (`phase-1` .. `phase-4`) or after any change to `src/core/` or `game.contract.json`.

## Steps
1. Run `npm run build` to ensure both Vite web bundle and `dist/headless.mjs` compile cleanly without TypeScript/bundler errors.
2. Run `npm test` to execute all unit tests, contract sync checks, scenario tests, error-code checks, and determinism checks.
3. Run `npm run verify` to generate fresh headless proof outputs into `docs/proof/phase-1/` and verify SHA-256 determinism across two runs.
4. Check `git status` and ensure no `.env`, secrets, or hand-edited proof files exist.
5. Never tag a phase if any test fails; if a requirement is incomplete, record it honestly as "chưa đạt" in the phase proof table.
